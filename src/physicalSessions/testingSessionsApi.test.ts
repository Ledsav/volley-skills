import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSession, closeSession, getSession, listPastSessions } from './testingSessionsApi';

const { mockRunTransaction, mockCollection, mockDoc, mockGetDoc, mockGetDocs, mockQuery } = vi.hoisted(() => ({
  mockRunTransaction: vi.fn(),
  mockCollection: vi.fn(() => 'sessions-collection'),
  mockDoc: vi.fn((...args: unknown[]) => ({ type: 'doc', args, id: 'session-1' })),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: mockRunTransaction,
  collection: mockCollection,
  doc: mockDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

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
