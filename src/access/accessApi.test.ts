import { describe, expect, it, vi, beforeEach } from 'vitest';
import { saveGrants, removeAllGrants, emptyGrantSet, listGrantHolders } from './accessApi';

const arrayUnion = vi.fn((...v: string[]) => ({ __op: 'union', v }));
const arrayRemove = vi.fn((...v: string[]) => ({ __op: 'remove', v }));
const update = vi.fn();
const set = vi.fn();
const del = vi.fn();
const commit = vi.fn().mockResolvedValue(undefined);
const getDocs = vi.fn();
const getDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn((_db, ...p) => p.join('/')),
  query: vi.fn((...a) => a),
  orderBy: vi.fn(() => 'orderBy'),
  limit: vi.fn(() => 'limit'),
  startAfter: vi.fn(() => 'startAfter'),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  arrayUnion: (...v: string[]) => arrayUnion(...v),
  arrayRemove: (...v: string[]) => arrayRemove(...v),
  serverTimestamp: () => 'TS',
  writeBatch: () => ({ update, set, delete: del, commit }),
  type: {},
}));
vi.mock('../firebase/config', () => ({ db: {} }));

const noMember = { exists: () => false, data: () => undefined };
const memberDoc = (role: string) => ({ exists: () => true, data: () => ({ role }) });

beforeEach(() => {
  getDoc.mockReset().mockResolvedValue(noMember);
  del.mockReset();
  update.mockReset(); set.mockReset(); commit.mockReset().mockResolvedValue(undefined); });

describe('saveGrants', () => {
  it('only writes docs whose membership changed', async () => {
    const prev = { teamIds: ['t1', 't2'], sections: { exercises: true, trainings: false, guides: false } };
    const next = { teamIds: ['t2', 't3'], sections: { exercises: false, trainings: true, guides: false } };
    await saveGrants('coach@example.com', next, prev, 'admin@x.y');

    expect(update).toHaveBeenCalledWith('clubs/club-1/teams/t3', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('clubs/club-1/teams/t1', { adminEmails: { __op: 'remove', v: ['coach@example.com'] } });
    expect(set).toHaveBeenCalledWith(
      'clubs/club-1/sectionAccess/trainings',
      { adminEmails: { __op: 'union', v: ['coach@example.com'] } },
      { merge: true },
    );
    expect(set).toHaveBeenCalledWith(
      'clubs/club-1/sectionAccess/exercises',
      { adminEmails: { __op: 'remove', v: ['coach@example.com'] } },
      { merge: true },
    );
    // t2 unchanged, guides unchanged → not written
    expect(update).not.toHaveBeenCalledWith('clubs/club-1/teams/t2', expect.anything());
    expect(set).not.toHaveBeenCalledWith('clubs/club-1/sectionAccess/guides', expect.anything(), expect.anything());
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('lowercases the email before writing grants', async () => {
    const next = { teamIds: ['t1'], sections: { exercises: true, trainings: false, guides: false } };
    await saveGrants('Coach@Example.COM', next, emptyGrantSet(), 'admin@x.y');
    expect(update).toHaveBeenCalledWith('clubs/club-1/teams/t1', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(set).toHaveBeenCalledWith(
      'clubs/club-1/sectionAccess/exercises',
      { adminEmails: { __op: 'union', v: ['coach@example.com'] } },
      { merge: true },
    );
    expect(getDoc).toHaveBeenCalledWith('clubs/club-1/members/coach@example.com');
  });

  it('creates the member doc in the same batch when the person is not yet a member', async () => {
    const next = { teamIds: ['t1'], sections: { exercises: false, trainings: false, guides: false } };
    await saveGrants('new@x.y', next, emptyGrantSet(), 'admin@x.y');
    expect(set).toHaveBeenCalledWith('clubs/club-1/members/new@x.y', {
      email: 'new@x.y', clubId: 'club-1', role: 'member', addedBy: 'admin@x.y', addedAt: 'TS',
    });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite an existing member doc', async () => {
    getDoc.mockResolvedValue(memberDoc('member'));
    const next = { teamIds: ['t1'], sections: { exercises: false, trainings: false, guides: false } };
    await saveGrants('old@x.y', next, emptyGrantSet(), 'admin@x.y');
    expect(set).not.toHaveBeenCalledWith('clubs/club-1/members/old@x.y', expect.anything());
  });

  it('emptyGrantSet has no teams and all sections false', () => {
    expect(emptyGrantSet()).toEqual({ teamIds: [], sections: { exercises: false, trainings: false, guides: false } });
  });
});

describe('listGrantHolders', () => {
  it('unions team adminEmails and section adminEmails per person, sorted', async () => {
    getDocs.mockResolvedValue({
      docs: [
        { id: 't1', data: () => ({ name: 'A', adminEmails: ['b@x.com', 'a@x.com'] }) },
        { id: 't2', data: () => ({ name: 'B', adminEmails: ['a@x.com'] }) },
      ],
    });
    getDoc.mockImplementation((path: string) => {
      const map: Record<string, string[]> = {
        'clubs/club-1/sectionAccess/exercises': ['a@x.com'],
        'clubs/club-1/sectionAccess/trainings': [],
        'clubs/club-1/sectionAccess/guides': ['c@x.com'],
      };
      return Promise.resolve({ data: () => ({ adminEmails: map[path] ?? [] }) });
    });

    const holders = await listGrantHolders();
    expect(holders.map((h) => h.email)).toEqual(['a@x.com', 'b@x.com', 'c@x.com']);
    expect(holders[0].grants).toEqual({
      teamIds: ['t1', 't2'],
      sections: { exercises: true, trainings: false, guides: false },
    });
    expect(holders[2].grants).toEqual({
      teamIds: [],
      sections: { exercises: false, trainings: false, guides: true },
    });
  });
});

describe('removeAllGrants', () => {
  function holders() {
    getDocs.mockResolvedValue({ docs: [{ id: 't1', data: () => ({ name: 'A', adminEmails: ['p@x.y'] }) }] });
  }
  function sections() {
    return (path: string) => {
      if (path.includes('/members/')) return Promise.resolve(memberDoc(roleUnderTest));
      return Promise.resolve({ data: () => ({ adminEmails: [] }) });
    };
  }
  let roleUnderTest = 'member';

  it("deletes a plain member's doc but keeps an admin's", async () => {
    holders();
    roleUnderTest = 'member';
    getDoc.mockImplementation(sections());
    await removeAllGrants('p@x.y');
    expect(del).toHaveBeenCalledWith('clubs/club-1/members/p@x.y');

    del.mockReset();
    roleUnderTest = 'admin';
    await removeAllGrants('p@x.y');
    expect(del).not.toHaveBeenCalled();
  });
});
