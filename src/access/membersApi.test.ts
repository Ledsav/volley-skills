import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Member } from '../types/club';
import { addMember, canChangeRole, removeFromClub, setMemberRole } from './membersApi';

const arrayRemove = vi.fn((...v: string[]) => ({ __op: 'remove', v }));
const update = vi.fn();
const set = vi.fn();
const del = vi.fn();
const commit = vi.fn();
const getDocs = vi.fn();
const getDoc = vi.fn();
const setDoc = vi.fn();
const updateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn((_db, ...p) => p.join('/')),
  query: vi.fn((...a) => a),
  orderBy: vi.fn(() => 'orderBy'),
  limit: vi.fn(() => 'limit'),
  startAfter: vi.fn(() => 'startAfter'),
  documentId: vi.fn(() => 'id'),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  setDoc: (...a: unknown[]) => setDoc(...a),
  updateDoc: (...a: unknown[]) => updateDoc(...a),
  arrayUnion: vi.fn(),
  arrayRemove: (...v: string[]) => arrayRemove(...v),
  serverTimestamp: () => 'TS',
  writeBatch: () => ({ update, set, delete: del, commit }),
}));
vi.mock('../firebase/config', () => ({ db: {} }));

beforeEach(() => {
  [update, set, del, setDoc, updateDoc, getDocs, getDoc].forEach((m) => m.mockReset());
  commit.mockReset().mockResolvedValue(undefined);
});

const m = (email: string, role: 'admin' | 'member'): Member =>
  ({ email, clubId: 'club-1', role, addedBy: 'x', addedAt: null as never });

describe('addMember', () => {
  it('creates { email, clubId, role, addedBy, addedAt } lowercased', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    await addMember(' New@X.Y ', 'member', 'Admin@X.Y');
    expect(setDoc).toHaveBeenCalledWith('clubs/club-1/members/new@x.y', {
      email: 'new@x.y', clubId: 'club-1', role: 'member', addedBy: 'admin@x.y', addedAt: 'TS',
    });
  });
  it('refuses an existing member', async () => {
    getDoc.mockResolvedValue({ exists: () => true });
    await expect(addMember('a@x.y', 'member', 'b@x.y')).rejects.toThrow('already-member');
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('setMemberRole', () => {
  it('updates only the role', async () => {
    await setMemberRole('A@x.y', 'admin');
    expect(updateDoc).toHaveBeenCalledWith('clubs/club-1/members/a@x.y', { role: 'admin' });
  });
});

describe('removeFromClub', () => {
  it('removes the email from team adminEmails and sectionAccess and deletes the member doc in one batch', async () => {
    getDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => ({ name: 'A', adminEmails: ['p@x.y'] }) }] });
    getDoc.mockImplementation((path: string) => Promise.resolve({
      data: () => ({ adminEmails: path.endsWith('/guides') ? ['p@x.y'] : [] }),
    }));
    await removeFromClub('P@x.y');
    expect(update).toHaveBeenCalledWith('clubs/club-1/teams/t1', { adminEmails: { __op: 'remove', v: ['p@x.y'] } });
    expect(set).toHaveBeenCalledWith(
      'clubs/club-1/sectionAccess/guides',
      { adminEmails: { __op: 'remove', v: ['p@x.y'] } },
      { merge: true },
    );
    expect(del).toHaveBeenCalledWith('clubs/club-1/members/p@x.y');
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe('canChangeRole', () => {
  const owner = m('o@x.y', 'admin');
  const other = m('a@x.y', 'admin');
  const plain = m('p@x.y', 'member');
  it('protects the owner and the last admin', () => {
    expect(canChangeRole(owner, [owner, other], 'o@x.y')).toEqual({
      demote: false, remove: false, reason: 'owner',
    });
    expect(canChangeRole(other, [other, plain], 'o@x.y')).toEqual({
      demote: false, remove: false, reason: 'lastAdmin',
    });
  });
  it('lets another admin be demoted but not removed directly', () => {
    expect(canChangeRole(other, [owner, other], 'o@x.y')).toEqual({
      demote: true, remove: false, reason: 'demoteFirst',
    });
  });
  it('lets a member be removed', () => {
    expect(canChangeRole(plain, [owner, plain], 'o@x.y')).toEqual({ demote: false, remove: true, reason: null });
  });
});
