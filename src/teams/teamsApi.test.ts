import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createTeam, listMyTeams, updateTeamDevelopmentPlan } from './teamsApi';

const { mockAddDoc, mockCollection, mockGetDocs, mockQuery, mockWhere, mockOrderBy, mockLimit, mockUpdateDoc } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockCollection: vi.fn(() => 'teams-collection'),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockWhere: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  mockOrderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  mockLimit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  mockUpdateDoc: vi.fn(),
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
}));

vi.mock('../firebase/config', () => ({ db: {} }));

describe('teamsApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a team with the creator as the sole admin', async () => {
    mockAddDoc.mockResolvedValue({ id: 'team-1' });

    const id = await createTeam(
      { name: 'U17', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '' },
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
});
