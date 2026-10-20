import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPhysicalTest, deletePhysicalTest, getLatestByType, getPhysicalTest, listHistoryByType, loadLatestTests } from './physicalTestsApi';

const { mockGetDoc, mockUpdateDoc, mockBatch, mockGetDocs, mockCollection, mockQuery, mockDeleteDoc, mockDoc } = vi.hoisted(() => ({
  mockGetDoc: vi.fn(),
  mockUpdateDoc: vi.fn(),
  mockBatch: { set: vi.fn(), update: vi.fn(), commit: vi.fn() },
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'physical-tests-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockDeleteDoc: vi.fn(),
  mockDoc: vi.fn((...args: unknown[]) => ({ type: 'doc', args, id: args.length === 1 ? 'new-test' : String(args[args.length - 1]) })),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  writeBatch: () => mockBatch,
  deleteField: () => 'DELETE_FIELD',
  getDocs: mockGetDocs,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  deleteDoc: mockDeleteDoc,
  doc: mockDoc,
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('physicalTestsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocs.mockReset();
    mockGetDoc.mockReset();
    mockBatch.commit.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockReset();
    mockDoc.mockClear();
  });

  const cmjInput = { testType: 'cmj' as const, attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' };
  const playerWith = (latestTests?: object) => ({ data: () => (latestTests ? { latestTests } : {}) });

  it('creates a physical test entry stamped with the recorder and a server timestamp', async () => {
    mockGetDoc.mockResolvedValue(playerWith({}));

    const id = await createPhysicalTest('team-1', 'player-1', cmjInput, 'coach-uid');

    expect(id).toBe('new-test');
    const [, payload] = mockBatch.set.mock.calls[0];
    expect(payload).toMatchObject({ testType: 'cmj', bestCm: 34, recordedBy: 'coach-uid', createdAt: 'server-timestamp' });
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('stores a new test as the latest of its type on the player, in the same batch', async () => {
    mockGetDoc.mockResolvedValue(playerWith({ cmj: { id: 'old', date: '2026-08-01' } }));

    await createPhysicalTest('team-1', 'player-1', cmjInput, 'coach-uid');

    expect(mockBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ args: [{}, 'teams', 'team-1', 'players', 'player-1'] }),
      { 'latestTests.cmj': expect.objectContaining({ id: 'new-test', bestCm: 34, date: '2026-09-07' }) }
    );
  });

  it('keeps the stored latest when the new test is backdated', async () => {
    mockGetDoc.mockResolvedValue(playerWith({ cmj: { id: 'newer', date: '2026-10-01' } }));

    await createPhysicalTest('team-1', 'player-1', cmjInput, 'coach-uid');

    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.update).not.toHaveBeenCalled();
  });

  it('leaves a player without a latestTests map for the backfill to build', async () => {
    mockGetDoc.mockResolvedValue(playerWith());

    await createPhysicalTest('team-1', 'player-1', cmjInput, 'coach-uid');

    expect(mockBatch.update).not.toHaveBeenCalled();
  });

  it('drops the map when the player cannot be read, so it is rebuilt instead of going stale', async () => {
    mockGetDoc.mockRejectedValue(new Error('offline'));

    await createPhysicalTest('team-1', 'player-1', cmjInput, 'coach-uid');

    expect(mockBatch.set).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalledWith(expect.anything(), { latestTests: 'DELETE_FIELD' });
  });

  it('uses the stored map without any query', async () => {
    const stored = { cmj: { id: 't1' } } as never;
    await expect(loadLatestTests('team-1', 'player-1', stored, true)).resolves.toBe(stored);
    expect(mockGetDocs).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('falls back to one query per type and backfills the map for an admin', async () => {
    mockGetDocs.mockImplementation(async (q: unknown[]) => {
      const isCmj = JSON.stringify(q).includes('"cmj"');
      return { docs: isCmj ? [{ id: 't1', data: () => ({ testType: 'cmj', date: '2026-09-01' }) }] : [] };
    });

    const latest = await loadLatestTests('team-1', 'player-1', undefined, true);

    expect(mockGetDocs).toHaveBeenCalledTimes(8);
    expect(latest).toEqual({ cmj: { id: 't1', testType: 'cmj', date: '2026-09-01' } });
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { latestTests: latest });
  });

  it('does not backfill for a viewer who cannot write the player', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    await loadLatestTests('team-1', 'player-1', undefined, false);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('gets the latest entry for a given test type', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) }],
    });

    const latest = await getLatestByType('team-1', 'player-1', 'cmj');

    expect(latest).toEqual({ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' });
  });

  it('returns null when no entry exists yet for that type', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const latest = await getLatestByType('team-1', 'player-1', 'cmj');

    expect(latest).toBeNull();
  });

  it('lists the entire physical-test history for a player, bounded by a defensive limit', async () => {
    const { listAllPhysicalTests } = await import('./physicalTestsApi');
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) },
        { id: 'test-2', data: () => ({ testType: 'growth', heightCm: 160, date: '2026-06-01' }) },
      ],
    });
    mockQuery.mockClear();

    const all = await listAllPhysicalTests('team-1', 'player-1');

    expect(all).toEqual([
      { id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' },
      { id: 'test-2', testType: 'growth', heightCm: 160, date: '2026-06-01' },
    ]);
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs).toContainEqual({ type: 'orderBy', args: ['date', 'desc'] });
    expect(queryArgs).toContainEqual({ type: 'limit', args: [500] });
  });

  it('lists history for one test type, paginated', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) }],
    });

    const { tests, lastDoc } = await listHistoryByType('team-1', 'player-1', 'cmj');

    expect(tests).toEqual([{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' }]);
    expect(lastDoc).toEqual({ id: 'test-1', data: expect.any(Function) });
  });

  it('lists an oldest-first series for one test type, for a trend chart', async () => {
    const { listSeriesByType } = await import('./physicalTestsApi');
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 30, date: '2026-01-10' }) },
        { id: 'test-2', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-02-10' }) },
      ],
    });
    mockQuery.mockClear();

    const series = await listSeriesByType('team-1', 'player-1', 'cmj');

    expect(series).toEqual([
      { id: 'test-1', testType: 'cmj', bestCm: 30, date: '2026-01-10' },
      { id: 'test-2', testType: 'cmj', bestCm: 34, date: '2026-02-10' },
    ]);
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs).toContainEqual({ type: 'orderBy', args: ['date', 'asc'] });
    expect(queryArgs).toContainEqual({ type: 'limit', args: [60] });
  });

  it('deletes a physical test entry and leaves the map alone when it was not the latest', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(playerWith({ cmj: { id: 'other', date: '2026-10-01' } }));

    await deletePhysicalTest('team-1', 'player-1', 'test-1');

    expect(mockDoc).toHaveBeenCalledWith({}, 'teams', 'team-1', 'players', 'player-1', 'physicalTests', 'test-1');
    expect(mockDeleteDoc).toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('promotes the next newest test when the latest is deleted', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(playerWith({ cmj: { id: 'test-1', date: '2026-10-01' } }));
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'test-0', data: () => ({ testType: 'cmj', date: '2026-09-01' }) }] });

    await deletePhysicalTest('team-1', 'player-1', 'test-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
      'latestTests.cmj': { id: 'test-0', testType: 'cmj', date: '2026-09-01' },
    });
  });

  it('removes the type from the map when its only test is deleted', async () => {
    mockDeleteDoc.mockResolvedValue(undefined);
    mockGetDoc.mockResolvedValue(playerWith({ cmj: { id: 'test-1', date: '2026-10-01' } }));
    mockGetDocs.mockResolvedValue({ docs: [] });

    await deletePhysicalTest('team-1', 'player-1', 'test-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), { 'latestTests.cmj': 'DELETE_FIELD' });
  });
});

describe('getPhysicalTest', () => {
  it('reads one saved test, or null when it is gone', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => true, id: 't1', data: () => ({ testType: 'cmj', bestCm: 34 }) });
    expect(await getPhysicalTest('team-1', 'p1', 't1')).toEqual({ id: 't1', testType: 'cmj', bestCm: 34 });
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });
    expect(await getPhysicalTest('team-1', 'p1', 'gone')).toBeNull();
  });
});
