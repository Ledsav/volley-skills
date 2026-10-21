import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { bulkCreateTeams, createTeam, deleteTeam, listMyTeams, updateTeamDevelopmentPlan } from './teamsApi';
import { deleteCollection } from '../firebase/deleteCollection';

const { mockAddDoc, mockCollection, mockGetDocs, mockQuery, mockWhere, mockOrderBy, mockLimit, mockUpdateDoc, mockDeleteDoc, mockWriteBatch } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'teams-collection'),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockWriteBatch: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  writeBatch: mockWriteBatch,
}));

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../firebase/deleteCollection');

describe('teamsApi', () => {
  // Retry tests run withBackoff's jittered sleeps on fake timers, so they
  // stay instant and don't depend on its default delays.
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a team with the creator as the sole admin', async () => {
    mockAddDoc.mockResolvedValue({ id: 'team-1' });

    const id = await createTeam(
      { name: 'U17', club: 'Demo VC', ageGroup: 'U17', season: '2026-27', description: '' },
      'creator-uid',
      'coach@example.com'
    );

    expect(id).toBe('team-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      name: 'U17',
      adminEmails: ['coach@example.com'],
      createdBy: 'creator-uid',
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    });
  });

  it('bulk-creates teams in one batch with creator as sole admin', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const count = await bulkCreateTeams(
      [
        { name: 'A', club: '', ageGroup: '', season: '', description: '' },
        { name: 'B', club: '', ageGroup: '', season: '', description: '' },
      ],
      'coach-uid',
      'coach@example.com'
    );

    expect(count).toBe(2);
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchSet.mock.calls[0][1]).toMatchObject({
      name: 'A',
      notes: '',
      adminEmails: ['coach@example.com'],
      createdBy: 'coach-uid',
      createdAt: 'server-timestamp',
    });
    expect(batchSet.mock.calls[1][1]).toMatchObject({ name: 'B', adminEmails: ['coach@example.com'] });
    expect(batchCommit).toHaveBeenCalledTimes(1);
  });

  it('retries the batch commit once on a transient resource-exhausted error', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'resource-exhausted' }))
      .mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    vi.useFakeTimers();
    const pending = bulkCreateTeams(
      [{ name: 'A', club: '', ageGroup: '', season: '', description: '' }],
      'coach-uid',
      'coach@example.com'
    );
    await vi.runAllTimersAsync();
    const count = await pending;

    expect(count).toBe(1);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });

  it('rejects a bulk team import above the MAX_IMPORT cap before any write', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn();
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    await expect(
      bulkCreateTeams(
        Array.from({ length: 101 }, () => ({ name: 'x', club: '', ageGroup: '', season: '', description: '' })),
        'coach-uid',
        'coach@example.com'
      )
    ).rejects.toThrow(/capped at 100 entries/);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('lists teams filtered to the given admin email', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'team-1', data: () => ({ name: 'U17' }) }],
    });

    const { teams, lastDoc } = await listMyTeams('coach@example.com', null);

    expect(teams).toEqual([{ id: 'team-1', name: 'U17' }]);
    expect(lastDoc).toEqual({ id: 'team-1', data: expect.any(Function) });
    expect(mockWhere).toHaveBeenCalledWith('adminEmails', 'array-contains', 'coach@example.com');
  });

  it('updates the team development plan', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updateTeamDevelopmentPlan('team-1', {
      shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Active', coachComment: '' }],
      seasonObjectives: [],
      generalNotes: 'On track',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', {
      developmentPlan: {
        shortTermObjectives: [{ objective: 'Improve serve', targetDate: '2026-12-01', status: 'Active', coachComment: '' }],
        seasonObjectives: [],
        generalNotes: 'On track',
      },
    });
  });

  it('clears every team subcollection, children first, before deleting the team itself', async () => {
    mockCollection.mockImplementation((...args: unknown[]) => args.slice(1).join('/') as never);
    const order: string[] = [];
    vi.mocked(deleteCollection).mockImplementation(async (col, beforeDelete) => {
      order.push(String(col));
      await beforeDelete?.('child-1');
    });
    mockDeleteDoc.mockImplementation(async () => {
      order.push('team-doc');
    });

    await deleteTeam('team-1');

    expect(order).toEqual([
      'clubs/club-1/teams/team-1/players',
      'clubs/club-1/teams/team-1/players/child-1/physicalTests',
      'clubs/club-1/teams/team-1/matches',
      'clubs/club-1/teams/team-1/matches/child-1/events',
      'clubs/club-1/teams/team-1/testingSessions',
      'clubs/club-1/teams/team-1/testingSessions/child-1/entries',
      'clubs/club-1/teams/team-1/calendar',
      'clubs/club-1/teams/team-1/scoutProfile',
      'team-doc',
    ]);
  });
});
