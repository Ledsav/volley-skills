import { describe, expect, it, vi, beforeEach } from 'vitest';
import { saveGrants, emptyGrantSet, listGrantHolders } from './accessApi';

const arrayUnion = vi.fn((...v: string[]) => ({ __op: 'union', v }));
const arrayRemove = vi.fn((...v: string[]) => ({ __op: 'remove', v }));
const update = vi.fn();
const commit = vi.fn().mockResolvedValue(undefined);
const getDocs = vi.fn();
const getDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: vi.fn((_db, c, id) => `${c}/${id}`),
  query: vi.fn((...a) => a),
  orderBy: vi.fn(() => 'orderBy'),
  limit: vi.fn(() => 'limit'),
  startAfter: vi.fn(() => 'startAfter'),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  arrayUnion: (...v: string[]) => arrayUnion(...v),
  arrayRemove: (...v: string[]) => arrayRemove(...v),
  writeBatch: () => ({ update, commit }),
  type: {},
}));
vi.mock('../firebase/config', () => ({ db: {} }));

beforeEach(() => { update.mockReset(); commit.mockReset().mockResolvedValue(undefined); });

describe('saveGrants', () => {
  it('only writes docs whose membership changed', async () => {
    const prev = { teamIds: ['t1', 't2'], sections: { exercises: true, trainings: false, guides: false } };
    const next = { teamIds: ['t2', 't3'], sections: { exercises: false, trainings: true, guides: false } };
    await saveGrants('coach@example.com', next, prev);

    expect(update).toHaveBeenCalledWith('teams/t3', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('teams/t1', { adminEmails: { __op: 'remove', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('sectionAccess/trainings', { adminEmails: { __op: 'union', v: ['coach@example.com'] } });
    expect(update).toHaveBeenCalledWith('sectionAccess/exercises', { adminEmails: { __op: 'remove', v: ['coach@example.com'] } });
    // t2 unchanged, guides unchanged → not written
    expect(update).not.toHaveBeenCalledWith('teams/t2', expect.anything());
    expect(update).not.toHaveBeenCalledWith('sectionAccess/guides', expect.anything());
    expect(commit).toHaveBeenCalledTimes(1);
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
        'sectionAccess/exercises': ['a@x.com'],
        'sectionAccess/trainings': [],
        'sectionAccess/guides': ['c@x.com'],
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
