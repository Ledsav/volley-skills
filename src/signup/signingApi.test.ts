import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitSignDraft } from './signingApi';
import { saveSignDraft, readSignDraft, type SignDraft } from '../legal/signDraft';

const m = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };
  return {
    batch,
    doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
    writeBatch: vi.fn(() => batch),
    getDoc: vi.fn(),
  };
});
vi.mock('firebase/firestore', () => ({
  doc: m.doc,
  writeBatch: m.writeBatch,
  getDoc: m.getDoc,
  serverTimestamp: () => 'TS',
}));
vi.mock('../firebase/config', () => ({ db: {}, auth: {} }));
vi.mock('../legal/acceptance', () => ({
  buildAcceptance: vi.fn(async (i: { email: string; authTime: number }) => ({
    versionKey: 'terms-2026-10-22_dpa-2026-10-22',
    acceptedBy: i.email,
    authTime: i.authTime,
  })),
}));

const NOW = 5_000_000_000;
const KEY = 'terms-2026-10-22_dpa-2026-10-22';
const ID = 'n'.repeat(20);
const common = {
  email: 'a@b.c',
  personName: 'Ann',
  termsVersion: '2026-10-22',
  dpaVersion: '2026-10-22',
  subprocessorsVersion: '2026-10-22',
  language: 'en' as const,
  savedAt: NOW - 1000,
};
const signup: SignDraft = { kind: 'signup', clubId: ID, club: { name: 'VC', country: 'LU', locale: 'en' }, ...common };
const reaccept: SignDraft = { kind: 'reaccept', clubId: ID, ...common };
const userAt = (authTimeSec: number, email = 'a@b.c') =>
  ({ email, getIdTokenResult: vi.fn().mockResolvedValue({ claims: { auth_time: authTimeSec } }) }) as never;
const fresh = () => userAt(NOW / 1000 - 60);

beforeEach(() => {
  localStorage.clear();
  m.writeBatch.mockClear();
  m.batch.set.mockReset();
  m.batch.update.mockReset();
  m.batch.commit.mockReset().mockResolvedValue(undefined);
  m.getDoc.mockReset();
});

describe('commitSignDraft', () => {
  it('returns noDraft without a draft and writes nothing', async () => {
    expect(await commitSignDraft(fresh(), NOW)).toBe('noDraft');
    expect(m.batch.commit).not.toHaveBeenCalled();
  });
  it('returns wrongAccount for another email and keeps the draft', async () => {
    saveSignDraft(signup);
    expect(await commitSignDraft(userAt(NOW / 1000, 'x@y.z'), NOW)).toBe('wrongAccount');
    expect(m.batch.commit).not.toHaveBeenCalled();
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('returns linkExpired past the window, before any write, keeping the draft', async () => {
    saveSignDraft(signup);
    expect(await commitSignDraft(userAt(NOW / 1000 - 15 * 60), NOW)).toBe('linkExpired');
    expect(m.writeBatch).not.toHaveBeenCalled();
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('writes three sets for a sign-up, stores the club and clears the draft', async () => {
    saveSignDraft(signup);
    expect(await commitSignDraft(fresh(), NOW)).toBe('done');
    expect(m.batch.set.mock.calls.map((c) => c[0])).toEqual([
      `clubs/${ID}`,
      `clubs/${ID}/members/a@b.c`,
      `clubs/${ID}/acceptances/${KEY}`,
    ]);
    expect(m.batch.update).not.toHaveBeenCalled();
    expect(localStorage.getItem('vcb.activeClub')).toBe(ID);
    expect(readSignDraft(NOW)).toBeNull();
  });
  it('writes one set and one update for a re-acceptance', async () => {
    saveSignDraft(reaccept);
    expect(await commitSignDraft(fresh(), NOW)).toBe('done');
    expect(m.batch.set.mock.calls.map((c) => c[0])).toEqual([`clubs/${ID}/acceptances/${KEY}`]);
    expect(m.batch.update.mock.calls.map((c) => c[0])).toEqual([`clubs/${ID}`]);
    expect(localStorage.getItem('vcb.activeClub')).toBeNull();
  });
  it('maps a refused retry to alreadyDone when our acceptance exists', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ acceptedBy: 'a@b.c' }) });
    expect(await commitSignDraft(fresh(), NOW)).toBe('alreadyDone');
    expect(readSignDraft(NOW)).toBeNull();
  });
  it('rethrows permission-denied when no acceptance of ours exists, keeping the draft', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => false });
    await expect(commitSignDraft(fresh(), NOW)).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('rethrows other errors without reading', async () => {
    saveSignDraft(reaccept);
    m.batch.commit.mockRejectedValue({ code: 'unavailable' });
    await expect(commitSignDraft(fresh(), NOW)).rejects.toBeDefined();
    expect(m.getDoc).not.toHaveBeenCalled();
  });
  it('keeps the original error when the already-done read fails, and the draft', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockRejectedValue({ code: 'permission-denied', note: 'read' });
    await expect(commitSignDraft(fresh(), NOW)).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('rethrows the original error when the acceptance belongs to someone else', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ acceptedBy: 'other@b.c' }) });
    await expect(commitSignDraft(fresh(), NOW)).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('passes lowercased, well-formed data to the batch', async () => {
    saveSignDraft({ ...signup, email: 'A@B.C' });
    expect(await commitSignDraft(fresh(), NOW)).toBe('done');
    const [club, member, acc] = m.batch.set.mock.calls;
    expect(club[1]).toMatchObject({ name: 'VC', country: 'LU', ownerEmail: 'a@b.c', status: 'pending', legal: { versionKey: KEY, acceptedBy: 'a@b.c' } });
    expect(member[0]).toBe(`clubs/${ID}/members/a@b.c`);
    expect(member[1]).toMatchObject({ email: 'a@b.c', clubId: ID, role: 'admin' });
    expect(acc[1]).toMatchObject({ versionKey: KEY, acceptedBy: 'a@b.c', acceptedAt: 'TS' });
  });
  it('passes the acceptance and legal update for a re-acceptance', async () => {
    saveSignDraft(reaccept);
    await commitSignDraft(fresh(), NOW);
    expect(m.batch.set.mock.calls[0][1]).toMatchObject({ versionKey: KEY, acceptedBy: 'a@b.c', acceptedAt: 'TS' });
    expect(m.batch.update.mock.calls[0][1]).toEqual({ legal: { versionKey: KEY, acceptedAt: 'TS', acceptedBy: 'a@b.c' } });
  });
  it('accepts an uppercase draft email for a lowercase user email', async () => {
    saveSignDraft({ ...reaccept, email: 'A@B.C' });
    expect(await commitSignDraft(fresh(), NOW)).toBe('done');
  });
});
