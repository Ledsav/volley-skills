import { beforeEach, describe, expect, it, vi } from 'vitest';
import { countClubMembers, listMyMemberships, probePlatformAdmin, subscribeClub } from './clubsApi';

const m = vi.hoisted(() => ({
  collectionGroup: vi.fn((_db: unknown, id: string) => `group:${id}`),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  query: vi.fn((...args: unknown[]) => args),
  doc: vi.fn((_db: unknown, ...p: string[]) => p.join('/')),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  getCountFromServer: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collectionGroup: m.collectionGroup,
  where: m.where,
  query: m.query,
  doc: m.doc,
  getDocs: m.getDocs,
  getDoc: m.getDoc,
  onSnapshot: m.onSnapshot,
  getCountFromServer: m.getCountFromServer,
}));
vi.mock('../firebase/clubPaths', () => ({ clubCol: (...p: string[]) => `club:${p.join('/')}` }));
const db = vi.hoisted(() => ({ name: 'db' }));
vi.mock('../firebase/config', () => ({ db }));

const memberDoc = (clubId: string, role: string) => ({
  data: () => ({ email: 'a@b.c', clubId, role }),
});
const clubSnap = (id: string, data: Record<string, unknown> | null) => ({
  id,
  exists: () => data !== null,
  data: vi.fn(() => data),
});

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockClear());
  m.getDocs.mockReset();
  m.getDoc.mockReset();
  m.onSnapshot.mockReset();
});

describe('listMyMemberships', () => {
  it('queries members by email across clubs and loads each club', async () => {
    m.getDocs.mockResolvedValue({ docs: [memberDoc('c1', 'admin'), memberDoc('c2', 'member')] });
    m.getDoc.mockImplementation((path: string) => Promise.resolve(
      path === 'clubs/c1'
        ? clubSnap('c1', { name: 'One', status: 'active' })
        : clubSnap('c2', { name: 'Two', status: 'pending' }),
    ));

    const result = await listMyMemberships('a@b.c');

    expect(m.collectionGroup).toHaveBeenCalledWith(db, 'members');
    expect(m.where).toHaveBeenCalledWith('email', '==', 'a@b.c');
    expect(m.query).toHaveBeenCalledWith('group:members', { type: 'where', args: ['email', '==', 'a@b.c'] });
    expect(result).toEqual([
      { clubId: 'c1', role: 'admin', clubName: 'One', status: 'active' },
      { clubId: 'c2', role: 'member', clubName: 'Two', status: 'pending' },
    ]);
  });

  it('skips a club that cannot be read', async () => {
    m.getDocs.mockResolvedValue({ docs: [memberDoc('c1', 'admin'), memberDoc('c2', 'member'), memberDoc('c3', 'member')] });
    m.getDoc.mockImplementation((path: string) => {
      if (path === 'clubs/c1') return Promise.reject({ code: 'permission-denied' });
      if (path === 'clubs/c2') return Promise.resolve(clubSnap('c2', null));
      return Promise.resolve(clubSnap('c3', { name: 'Three', status: 'active' }));
    });

    expect(await listMyMemberships('a@b.c')).toEqual([
      { clubId: 'c3', role: 'member', clubName: 'Three', status: 'active' },
    ]);
  });
});

describe('listMyMemberships errors', () => {
  it('rethrows a transient club read error instead of dropping the club', async () => {
    m.getDocs.mockResolvedValue({ docs: [memberDoc('c1', 'admin')] });
    m.getDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(listMyMemberships('a@b.c')).rejects.toEqual({ code: 'unavailable' });
  });
});

describe('probePlatformAdmin', () => {
  it('reports whether the platformAdmins doc exists', async () => {
    m.getDoc.mockResolvedValueOnce(clubSnap('a@b.c', {}));
    expect(await probePlatformAdmin('a@b.c')).toBe(true);
    expect(m.doc).toHaveBeenCalledWith(db, 'platformAdmins', 'a@b.c');
    m.getDoc.mockResolvedValueOnce(clubSnap('a@b.c', null));
    expect(await probePlatformAdmin('a@b.c')).toBe(false);
  });

  it('treats a denied platformAdmins probe as not an admin', async () => {
    m.getDoc.mockRejectedValue({ code: 'permission-denied' });
    expect(await probePlatformAdmin('a@b.c')).toBe(false);
  });

  it('rethrows other probe errors', async () => {
    m.getDoc.mockRejectedValue({ code: 'unavailable' });
    await expect(probePlatformAdmin('a@b.c')).rejects.toEqual({ code: 'unavailable' });
  });
});

describe('subscribeClub', () => {
  it('passes the live club, and null for a missing doc or an error', () => {
    const unsub = vi.fn();
    m.onSnapshot.mockReturnValue(unsub);
    const onClub = vi.fn();

    expect(subscribeClub('c1', onClub)).toBe(unsub);
    expect(m.doc).toHaveBeenCalledWith(db, 'clubs', 'c1');
    const [, next, error] = m.onSnapshot.mock.calls[0];
    next(clubSnap('c1', { name: 'One', status: 'suspended' }));
    expect(onClub).toHaveBeenLastCalledWith({ id: 'c1', name: 'One', status: 'suspended' });
    next(clubSnap('c1', null));
    expect(onClub).toHaveBeenLastCalledWith(null);
    onClub.mockClear();
    error({ code: 'permission-denied' });
    expect(onClub).toHaveBeenCalledWith(null);
  });

  it('reads pending server timestamps as estimates', () => {
    subscribeClub('c1', vi.fn());
    const [, next] = m.onSnapshot.mock.calls[0];
    const snap = clubSnap('c1', { name: 'One' });
    next(snap);
    expect(snap.data).toHaveBeenCalledWith({ serverTimestamps: 'estimate' });
  });
});

describe('countClubMembers', () => {
  it('counts the members collection on the server', async () => {
    m.getCountFromServer.mockResolvedValueOnce({ data: () => ({ count: 3 }) });
    expect(await countClubMembers()).toBe(3);
    expect(m.getCountFromServer).toHaveBeenCalledWith('club:members');
  });
});
