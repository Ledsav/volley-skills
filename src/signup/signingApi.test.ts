import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commitSignDraft } from './signingApi';
import { saveSignDraft, readSignDraft, type SignDraft } from '../legal/signDraft';
import { buildAcceptance } from '../legal/acceptance';

const m = vi.hoisted(() => {
  const batch = { set: vi.fn(), update: vi.fn(), commit: vi.fn() };
  return {
    batch,
    doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
    writeBatch: vi.fn(() => batch),
    getDoc: vi.fn(),
    auth: { currentUser: null as unknown },
  };
});
vi.mock('firebase/firestore', () => ({
  doc: m.doc,
  writeBatch: m.writeBatch,
  getDoc: m.getDoc,
  serverTimestamp: () => 'TS',
}));
vi.mock('../firebase/config', () => ({ db: {}, auth: m.auth }));
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

/** Signs `user` in as the SDK's current user, then commits. */
const commitAs = (user: unknown) => {
  m.auth.currentUser = user;
  return commitSignDraft(NOW);
};

beforeEach(() => {
  localStorage.clear();
  m.auth.currentUser = null;
  m.writeBatch.mockClear();
  m.batch.set.mockReset();
  m.batch.update.mockReset();
  m.batch.commit.mockReset().mockResolvedValue(undefined);
  m.getDoc.mockReset();
});

describe('commitSignDraft', () => {
  it('reads the token of the current auth user at commit time', async () => {
    // A same-uid re-sign-in replaces auth.currentUser with a new object and fires no auth-state
    // event, so a user captured earlier carries the old auth_time; the commit must not use it.
    saveSignDraft(signup);
    const stale = userAt(NOW / 1000 - 20 * 60) as unknown as { getIdTokenResult: ReturnType<typeof vi.fn> };
    const current = userAt(NOW / 1000 - 30) as unknown as { getIdTokenResult: ReturnType<typeof vi.fn> };
    m.auth.currentUser = stale;
    m.auth.currentUser = current;
    expect(await commitSignDraft(NOW)).toBe('done');
    expect(current.getIdTokenResult).toHaveBeenCalledWith(true);
    expect(stale.getIdTokenResult).not.toHaveBeenCalled();
    expect(vi.mocked(buildAcceptance).mock.lastCall?.[0]).toMatchObject({ authTime: NOW / 1000 - 30 });
  });
  it('fails without a signed-in user and writes nothing', async () => {
    saveSignDraft(signup);
    await expect(commitAs(null)).rejects.toThrow();
    expect(m.writeBatch).not.toHaveBeenCalled();
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('returns noDraft without a draft and writes nothing', async () => {
    expect(await commitAs(fresh())).toBe('noDraft');
    expect(m.batch.commit).not.toHaveBeenCalled();
  });
  it('returns wrongAccount for another email and keeps the draft', async () => {
    saveSignDraft(signup);
    expect(await commitAs(userAt(NOW / 1000, 'x@y.z'))).toBe('wrongAccount');
    expect(m.batch.commit).not.toHaveBeenCalled();
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('returns linkExpired past the window, before any write, keeping the draft', async () => {
    saveSignDraft(signup);
    expect(await commitAs(userAt(NOW / 1000 - 15 * 60))).toBe('linkExpired');
    expect(m.writeBatch).not.toHaveBeenCalled();
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('writes three sets for a sign-up, stores the club and clears the draft', async () => {
    saveSignDraft(signup);
    expect(await commitAs(fresh())).toBe('done');
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
    expect(await commitAs(fresh())).toBe('done');
    expect(m.batch.set.mock.calls.map((c) => c[0])).toEqual([`clubs/${ID}/acceptances/${KEY}`]);
    expect(m.batch.update.mock.calls.map((c) => c[0])).toEqual([`clubs/${ID}`]);
    expect(localStorage.getItem('vcb.activeClub')).toBeNull();
  });
  it('maps a refused retry to alreadyDone when our acceptance exists', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ acceptedBy: 'a@b.c' }) });
    expect(await commitAs(fresh())).toBe('alreadyDone');
    expect(readSignDraft(NOW)).toBeNull();
  });
  it('rethrows permission-denied when no acceptance of ours exists, keeping the draft', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => false });
    await expect(commitAs(fresh())).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('rethrows other errors without reading', async () => {
    saveSignDraft(reaccept);
    m.batch.commit.mockRejectedValue({ code: 'unavailable' });
    await expect(commitAs(fresh())).rejects.toBeDefined();
    expect(m.getDoc).not.toHaveBeenCalled();
  });
  it('keeps the original error when the already-done read fails, and the draft', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockRejectedValue({ code: 'permission-denied', note: 'read' });
    await expect(commitAs(fresh())).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('rethrows the original error when the acceptance belongs to someone else', async () => {
    saveSignDraft(signup);
    m.batch.commit.mockRejectedValue({ code: 'permission-denied' });
    m.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ acceptedBy: 'other@b.c' }) });
    await expect(commitAs(fresh())).rejects.toEqual({ code: 'permission-denied' });
    expect(readSignDraft(NOW)).not.toBeNull();
  });
  it('passes lowercased, well-formed data to the batch', async () => {
    saveSignDraft({ ...signup, email: 'A@B.C' });
    expect(await commitAs(fresh())).toBe('done');
    const [club, member, acc] = m.batch.set.mock.calls;
    expect(club[1]).toMatchObject({ name: 'VC', country: 'LU', ownerEmail: 'a@b.c', status: 'pending', legal: { versionKey: KEY, acceptedBy: 'a@b.c' } });
    expect(member[0]).toBe(`clubs/${ID}/members/a@b.c`);
    expect(member[1]).toMatchObject({ email: 'a@b.c', clubId: ID, role: 'admin' });
    expect(acc[1]).toMatchObject({ versionKey: KEY, acceptedBy: 'a@b.c', acceptedAt: 'TS' });
  });
  it('passes the acceptance and legal update for a re-acceptance', async () => {
    saveSignDraft(reaccept);
    await commitAs(fresh());
    expect(m.batch.set.mock.calls[0][1]).toMatchObject({ versionKey: KEY, acceptedBy: 'a@b.c', acceptedAt: 'TS' });
    expect(m.batch.update.mock.calls[0][1]).toEqual({ legal: { versionKey: KEY, acceptedAt: 'TS', acceptedBy: 'a@b.c' } });
  });
  it('accepts an uppercase draft email for a lowercase user email', async () => {
    saveSignDraft({ ...reaccept, email: 'A@B.C' });
    expect(await commitAs(fresh())).toBe('done');
  });
});
