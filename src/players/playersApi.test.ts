import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createPlayer, listPlayers } from './playersApi';
import type { Team } from '../types/team';

const { mockAddDoc, mockGetDocs, mockCollection, mockQuery } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'players-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
}));

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  limit: vi.fn((...args: unknown[]) => ({ type: 'limit', args })),
  startAfter: vi.fn((...args: unknown[]) => ({ type: 'startAfter', args })),
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('../firebase/config', () => ({ db: {} }));

const team: Team = {
  id: 'team-1',
  name: 'U17',
  club: 'VCB',
  ageGroup: 'U17',
  season: '2026-27',
  description: '',
  notes: '',
  adminEmails: ['coach@example.com'],
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  createdBy: 'coach-uid',
  createdAt: null,
};

describe('playersApi', () => {
  beforeEach(() => {
    mockAddDoc.mockReset();
    mockGetDocs.mockReset();
  });

  it('creates a player with empty skills and denormalized team fields', async () => {
    mockAddDoc.mockResolvedValue({ id: 'player-1' });

    const id = await createPlayer(
      'team-1',
      team,
      {
        number: 7,
        fullName: 'Test Player',
        dob: '2012-01-01',
        nationality: 'BEL',
        licenseNumber: 'J-000001',
        position: 'OH',
        playerPhone: '',
        guardians: [],
      },
      'coach-uid'
    );

    expect(id).toBe('player-1');
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload).toMatchObject({
      fullName: 'Test Player',
      teamName: 'U17',
      ageGroup: 'U17',
      season: '2026-27',
      viewerEmails: [],
      avgScore: null,
      level: null,
      consent: { given: false, date: null, confirmedBy: null },
      skills: { serve: { score: null, notes: '', priority: false } },
    });
  });

  it('lists players ordered by number', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'player-1', data: () => ({ fullName: 'Test Player' }) }] });

    const { players, lastDoc } = await listPlayers('team-1');

    expect(players).toEqual([{ id: 'player-1', fullName: 'Test Player' }]);
    expect(lastDoc).toEqual({ id: 'player-1', data: expect.any(Function) });
  });
});
