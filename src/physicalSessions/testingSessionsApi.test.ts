import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSession, closeSession, deleteSession, getSession, listPastSessions, listSessionEntries, subscribeEntries, saveEntryProgress, finishEntry } from './testingSessionsApi';
import { deletePhysicalTest } from '../players/physicalTestsApi';

const { mockRunTransaction, mockCollection, mockDoc, mockGetDoc, mockGetDocs, mockOnSnapshot, mockQuery, mockSetDoc, mockBatch } = vi.hoisted(() => ({
  mockBatch: { delete: vi.fn(), update: vi.fn(), commit: vi.fn() },
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'sessions-collection'),
  mockDoc: vi.fn((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1' })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockSetDoc: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  onSnapshot: mockOnSnapshot,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: () => 'server-timestamp',
  setDoc: mockSetDoc,
  writeBatch: () => mockBatch,
}));

vi.mock('../firebase/config', () => ({ db: {} }));

vi.mock('../players/physicalTestsApi', () => ({ createPhysicalTest: vi.fn(), deletePhysicalTest: vi.fn() }));

describe('testingSessionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1' }));
  });

  it('starts a session inside a transaction when the team has no active session', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ data: () => ({ activeTestingSessionId: null }) }),
      set: vi.fn(),
      update: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    const id = await startSession('team-1', '2026-09-16', 'coach-uid');

    expect(id).toBe('session-1');
    expect(tx.set).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'session-1' }),
      expect.objectContaining({ date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: 'server-timestamp', closedAt: null })
    );
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { activeTestingSessionId: 'session-1' });
  });

  it('refuses to start a session when the team already has one open', async () => {
    const tx = {
      get: vi.fn().mockResolvedValue({ data: () => ({ activeTestingSessionId: 'session-existing' }) }),
      set: vi.fn(),
      update: vi.fn(),
    };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(startSession('team-1', '2026-09-16', 'coach-uid')).rejects.toThrow(
      'A testing session is already open for this team.'
    );
    expect(tx.set).not.toHaveBeenCalled();
  });

  it('closes a session inside a transaction and clears the team pointer', async () => {
    const tx = { update: vi.fn() };
    mockRunTransaction.mockImplementation(async (_db: unknown, fn: (t: typeof tx) => unknown) => fn(tx));

    await closeSession('team-1', 'session-1');

    expect(tx.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'closed', closedAt: 'server-timestamp' })
    );
    expect(tx.update).toHaveBeenCalledWith(expect.anything(), { activeTestingSessionId: null });
  });

  it('gets a session by id', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true, id: 'session-1', data: () => ({ date: '2026-09-16', status: 'open' }) });

    const session = await getSession('team-1', 'session-1');

    expect(session).toEqual({ id: 'session-1', date: '2026-09-16', status: 'open' });
  });

  it('returns null when the session does not exist', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    expect(await getSession('team-1', 'missing')).toBeNull();
  });

  it('lists closed sessions, most recent first, bounded to 50', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'session-1', data: () => ({ date: '2026-09-10', status: 'closed' }) }],
    });

    const sessions = await listPastSessions('team-1');

    expect(sessions).toEqual([{ id: 'session-1', date: '2026-09-10', status: 'closed' }]);
    const queryArgs = mockQuery.mock.calls[0];
    expect(queryArgs).toContainEqual({ type: 'where', args: ['status', '==', 'closed'] });
    expect(queryArgs).toContainEqual({ type: 'orderBy', args: ['date', 'desc'] });
    expect(queryArgs).toContainEqual({ type: 'limit', args: [50] });
  });
});

describe('testingSessionsApi entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...args: unknown[]) => ({ type: 'doc', args, id: 'player-1__cmj' }));
  });

  it('streams entries for a session through one listener', () => {
    const unsubscribe = vi.fn();
    mockOnSnapshot.mockImplementation((_ref, onNext: (s: unknown) => void) => {
      onNext({
        docs: [{ id: 'player-1__cmj', data: () => ({ playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {}, resultTestId: null }) }],
      });
      return unsubscribe;
    });
    const onChange = vi.fn();

    expect(subscribeEntries('team-1', 'session-1', onChange, vi.fn())).toBe(unsubscribe);

    expect(onChange.mock.calls[0][0]).toEqual([
      { id: 'player-1__cmj', playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {}, resultTestId: null },
    ]);
  });

  it('saves in-progress draft data for one player+quality', async () => {
    mockSetDoc.mockResolvedValue(undefined);

    await saveEntryProgress('team-1', 'session-1', 'player-1', 'cmj', { cmjAttempts: [30] });

    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: { cmjAttempts: [30] },
        updatedAt: 'server-timestamp',
      }),
      { merge: true }
    );
  });

  it('finishes an entry: writes the physicalTest and marks the entry complete', async () => {
    const { createPhysicalTest } = await import('../players/physicalTestsApi');
    vi.mocked(createPhysicalTest).mockResolvedValue('test-99');
    mockSetDoc.mockResolvedValue(undefined);

    const input = { testType: 'cmj' as const, attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-16', notes: '' };
    const resultId = await finishEntry('team-1', 'session-1', 'player-1', 'cmj', input, 'coach-uid');

    expect(resultId).toBe('test-99');
    expect(createPhysicalTest).toHaveBeenCalledWith('team-1', 'player-1', input, 'coach-uid');
    expect(mockSetDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'complete', resultTestId: 'test-99', updatedAt: 'server-timestamp' }),
      { merge: true }
    );
  });
});

describe('listSessionEntries', () => {
  it("reads a session's entries once", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'p1__cmj', data: () => ({ playerId: 'p1', testType: 'cmj', status: 'complete' }) }] });
    const entries = await listSessionEntries('team-1', 'session-1');
    expect(mockCollection).toHaveBeenCalledWith({}, 'clubs', 'club-1', 'teams', 'team-1', 'testingSessions', 'session-1', 'entries');
    expect(entries).toEqual([{ id: 'p1__cmj', playerId: 'p1', testType: 'cmj', status: 'complete' }]);
  });
});

describe('deleteSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockImplementation((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1', path: args.slice(1).join('/') }));
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'p1__cmj', data: () => ({ playerId: 'p1', testType: 'cmj', status: 'complete', resultTestId: 't1' }) },
        { id: 'p2__cmj', data: () => ({ playerId: 'p2', testType: 'cmj', status: 'in_progress', resultTestId: null }) },
      ],
    });
  });

  it("deletes the session's saved results, its entries and the session itself", async () => {
    mockGetDoc.mockResolvedValue({ data: () => ({ activeTestingSessionId: null }) });
    await deleteSession('team-1', 'session-1');
    expect(deletePhysicalTest).toHaveBeenCalledTimes(1);
    expect(deletePhysicalTest).toHaveBeenCalledWith('team-1', 'p1', 't1');
    const deleted = mockBatch.delete.mock.calls.map(([ref]) => ref.path);
    expect(deleted).toEqual([
      'clubs/club-1/teams/team-1/testingSessions/session-1/entries/p1__cmj',
      'clubs/club-1/teams/team-1/testingSessions/session-1/entries/p2__cmj',
      'clubs/club-1/teams/team-1/testingSessions/session-1',
    ]);
    expect(mockBatch.update).not.toHaveBeenCalled();
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it('clears the team pointer when deleting the open session', async () => {
    mockGetDoc.mockResolvedValue({ data: () => ({ activeTestingSessionId: 'session-1' }) });
    await deleteSession('team-1', 'session-1');
    expect(mockBatch.update).toHaveBeenCalledWith(expect.objectContaining({ path: 'clubs/club-1/teams/team-1' }), { activeTestingSessionId: null });
  });
});
