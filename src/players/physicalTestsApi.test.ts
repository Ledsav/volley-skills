import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPhysicalTest, getLatestByType, listHistoryByType } from './physicalTestsApi';

const { mockAddDoc, mockGetDocs, mockCollection, mockQuery } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'physical-tests-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('physicalTestsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a physical test entry stamped with the recorder and a server timestamp', async () => {
    mockAddDoc.mockResolvedValue({ id: 'test-1' });

    const id = await createPhysicalTest(
      'team-1',
      'player-1',
      { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' },
      'coach-uid'
    );

    expect(id).toBe('test-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      testType: 'cmj',
      bestCm: 34,
      recordedBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
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

    const all = await listAllPhysicalTests('team-1', 'player-1');

    expect(all).toEqual([
      { id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' },
      { id: 'test-2', testType: 'growth', heightCm: 160, date: '2026-06-01' },
    ]);
  });

  it('lists history for one test type, paginated', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'test-1', data: () => ({ testType: 'cmj', bestCm: 34, date: '2026-09-07' }) }],
    });

    const { tests, lastDoc } = await listHistoryByType('team-1', 'player-1', 'cmj');

    expect(tests).toEqual([{ id: 'test-1', testType: 'cmj', bestCm: 34, date: '2026-09-07' }]);
    expect(lastDoc).toEqual({ id: 'test-1', data: expect.any(Function) });
  });
});
