import { describe, expect, it, vi, beforeEach } from 'vitest';
import { erasePlayerFootprint, loadPlayerFootprint } from './playerFootprintApi';
import { readAll } from '../firebase/readAll';

const { mockUpdateDoc, mockSetDoc, mockBatchDelete, mockBatchCommit } = vi.hoisted(() => ({
  mockUpdateDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockBatchDelete: vi.fn(),
  mockBatchCommit: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  doc: (_db: unknown, ...path: string[]) => path.join('/'),
  where: (...args: unknown[]) => ({ type: 'where', args }),
  deleteField: () => 'DELETE',
  updateDoc: mockUpdateDoc,
  setDoc: mockSetDoc,
  writeBatch: () => ({ delete: mockBatchDelete, commit: mockBatchCommit }),
}));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../firebase/readAll');

const snap = (id: string, data: object) => ({ id, data: () => data });

const roster = [
  { playerId: 'p1', number: 7, name: 'Ana Lima', positionCategory: 'OH' },
  { playerId: 'p2', number: 9, name: 'Bea Rossi', positionCategory: 'S' },
];

beforeEach(() => {
  vi.mocked(readAll).mockReset();
  vi.mocked(readAll).mockImplementation(async (col) => {
    const path = col as unknown as string;
    if (path === 'clubs/club-1/teams/t1/testingSessions') return [snap('s1', { date: '2026-09-20' }), snap('s2', { date: '2026-09-27' })] as never;
    if (path === 'clubs/club-1/teams/t1/testingSessions/s1/entries') return [snap('p1__cmj', { playerId: 'p1', testType: 'cmj' })] as never;
    if (path === 'clubs/club-1/teams/t1/testingSessions/s2/entries') return [] as never;
    if (path === 'clubs/club-1/teams/t1/matches')
      return [
        snap('m1', { date: '2026-10-01', opponent: 'Rivals', roster, liberos: [], summary: null }),
        snap('m2', { date: '2026-10-08', opponent: 'Others', roster: [roster[1]], liberos: [], summary: null }),
      ] as never;
    throw new Error(`unexpected ${path}`);
  });
  mockUpdateDoc.mockReset();
  mockSetDoc.mockReset();
  mockBatchDelete.mockReset();
  mockBatchCommit.mockReset();
});

describe('playerFootprintApi', () => {
  it('loads the player entries per session and only the matches they played', async () => {
    const fp = await loadPlayerFootprint('t1', 'p1');
    expect(fp.testingEntries).toEqual([
      { sessionId: 's1', sessionDate: '2026-09-20', entry: { id: 'p1__cmj', playerId: 'p1', testType: 'cmj' } },
    ]);
    expect(fp.matches.map((m) => m.matchId)).toEqual(['m1']);
    expect(fp.matches[0].rosterEntry.name).toBe('Ana Lima');
  });

  it('deletes entries, anonymizes rosters and drops the usage line', async () => {
    await erasePlayerFootprint('t1', 'p1');

    expect(mockBatchDelete).toHaveBeenCalledWith('clubs/club-1/teams/t1/testingSessions/s1/entries/p1__cmj');
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc).toHaveBeenCalledWith('clubs/club-1/teams/t1/matches/m1', {
      roster: [{ playerId: 'p1', number: 0, name: 'Removed player', positionCategory: 'OH' }, roster[1]],
    });
    expect(mockSetDoc).toHaveBeenCalledWith('clubs/club-1/teams/t1/scoutProfile/usage', { players: { p1: 'DELETE' } }, { merge: true });
  });
});
