import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORMAT } from '../types/match';
import { addEvent, createMatch, hasAnyMatch, listFinishedMatches, listMatchesInRange, loadTeamRoster, subscribeEvents, subscribeMatch } from './matchesApi';
import * as playersApi from '../players/playersApi';

const m = vi.hoisted(() => ({
  setDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  doc: vi.fn(() => ({ id: 'new-id' })),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'col'),
  doc: m.doc,
  setDoc: m.setDoc,
  getDoc: vi.fn(),
  getDocs: m.getDocs,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: m.onSnapshot,
  writeBatch: vi.fn(() => ({ update: vi.fn(), set: vi.fn(), delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) })),
  query: vi.fn((...args: unknown[]) => args),
  where: m.where,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn(),
  serverTimestamp: () => 'ts',
}));
vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../players/playersApi');

describe('matchesApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a match in setup state without awaiting the server and returns its id', () => {
    const { id, written } = createMatch(
      'team-1',
      { date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [] },
      'uid-1',
    );
    expect(id).toBe('new-id');
    expect(written).toBeInstanceOf(Promise);
    expect(m.setDoc).toHaveBeenCalledWith(
      { id: 'new-id' },
      expect.objectContaining({ status: 'setup', summary: null, usageContribution: null, activeDevice: null, createdBy: 'uid-1' }),
    );
  });

  it('lists finished matches', async () => {
    m.getDocs.mockResolvedValue({ docs: [{ id: 'm1', data: () => ({ date: '2026-10-18', status: 'finished' }) }] });
    expect(await listFinishedMatches('team-1')).toEqual([{ id: 'm1', date: '2026-10-18', status: 'finished' }]);
    expect(m.where).toHaveBeenCalledWith('status', '==', 'finished');
  });

  it('queries matches in a date range', async () => {
    m.getDocs.mockResolvedValue({ docs: [{ id: 'm1', data: () => ({ date: '2026-10-18' }) }] });
    expect(await listMatchesInRange('team-1', '2026-10-01', '2026-10-31')).toEqual([{ id: 'm1', date: '2026-10-18' }]);
    expect(m.where).toHaveBeenCalledWith('date', '>=', '2026-10-01');
    expect(m.where).toHaveBeenCalledWith('date', '<=', '2026-10-31');
  });

  it('writes an event without awaiting the server and returns its id', () => {
    const { id, written } = addEvent(
      'team-1', 'm1',
      { type: 'timeout', team: 'us', order: 3, source: 'tap', chunkId: null },
      'uid-1',
    );
    expect(id).toBe('new-id');
    expect(written).toBeInstanceOf(Promise);
    expect(m.setDoc).toHaveBeenCalledWith({ id: 'new-id' }, expect.objectContaining({ type: 'timeout', order: 3, createdBy: 'uid-1' }));
  });

  it('reports pending writes from snapshot metadata', () => {
    m.onSnapshot.mockImplementation((_q, _opts, next) => {
      next({
        metadata: { hasPendingWrites: true },
        docs: [
          { id: 'e1', data: () => ({ order: 1 }), metadata: { hasPendingWrites: false } },
          { id: 'e2', data: () => ({ order: 2 }), metadata: { hasPendingWrites: true } },
        ],
      });
      return () => undefined;
    });
    const onChange = vi.fn();
    subscribeEvents('team-1', 'm1', onChange, vi.fn());
    expect(onChange).toHaveBeenCalledWith([{ id: 'e1', order: 1 }, { id: 'e2', order: 2 }], 1);
  });

  it('subscribes to the match doc and maps a missing doc to null', () => {
    m.onSnapshot.mockImplementation((_ref, next) => {
      next({ exists: () => true, id: 'm1', data: () => ({ opponent: 'Rivals' }) });
      next({ exists: () => false, id: 'm1', data: () => undefined });
      return () => undefined;
    });
    const onChange = vi.fn();
    subscribeMatch('team-1', 'm1', onChange, vi.fn());
    expect(onChange).toHaveBeenNthCalledWith(1, { id: 'm1', opponent: 'Rivals' });
    expect(onChange).toHaveBeenNthCalledWith(2, null);
  });

  it('loads every roster page', async () => {
    vi.mocked(playersApi.listPlayers)
      .mockResolvedValueOnce({ players: [{ id: 'a' }] as never, lastDoc: 'cursor' as never, hasMore: true })
      .mockResolvedValueOnce({ players: [{ id: 'b' }] as never, lastDoc: null, hasMore: false });
    expect((await loadTeamRoster('team-1')).map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('hasAnyMatch asks for one document of the whole matches collection', async () => {
    m.getDocs.mockResolvedValueOnce({ empty: false });
    expect(await hasAnyMatch('team-1')).toBe(true);
    expect(m.getDocs).toHaveBeenCalledWith(['col', { type: 'limit', args: [1] }]);
    m.getDocs.mockResolvedValueOnce({ empty: true });
    expect(await hasAnyMatch('team-1')).toBe(false);
  });
});
