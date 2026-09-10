import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  bulkCreatePlayers,
  createPlayer,
  deletePlayer,
  listPlayers,
  setPlayerStarting,
  updatePlayerContact,
  updatePlayerDevelopmentPlan,
} from './playersApi';
import type { Team } from '../types/team';

const { mockAddDoc, mockGetDocs, mockCollection, mockQuery, mockUpdateDoc, mockDeleteDoc, mockWriteBatch } = vi.hoisted(() => ({
  mockAddDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn(() => 'players-collection'),
  mockQuery: vi.fn((...args: unknown[]) => args),
  mockUpdateDoc: vi.fn(),
  mockDeleteDoc: vi.fn(),
  mockWriteBatch: vi.fn(),
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
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  writeBatch: mockWriteBatch,
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

  it('creates a player with empty skills, denormalized team fields, and given consent', async () => {
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
        positionCategory: 'OH',
        playerPhone: '',
        guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      },
      'coach-uid',
      'coach@example.com'
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
      positionCategory: 'OH',
      starting: false,
      guardians: [{ relation: 'mother', name: 'Jane Doe', phone: '+352 000 000', email: 'jane@example.com' }],
      consent: { given: true, confirmedBy: 'coach@example.com' },
      skills: { serve: { score: null, notes: '', priority: false } },
    });
    expect(payload.consent.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults a new player to the TBD position category when none is given', async () => {
    mockAddDoc.mockResolvedValue({ id: 'player-2' });

    await createPlayer(
      'team-1',
      team,
      {
        number: 9,
        fullName: 'No Position',
        dob: '2012-01-01',
        nationality: 'BEL',
        licenseNumber: 'J-000009',
        playerPhone: '',
        guardians: [],
      },
      'coach-uid',
      'coach@example.com'
    );

    expect(mockAddDoc.mock.calls[0][1]).toMatchObject({ positionCategory: 'TBD', starting: false });
  });

  it('bulk-creates players with computed skills, forced consent-not-given, and denormalised team fields', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn().mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const team = { id: 'team-1', name: 'U17', ageGroup: 'U17', season: '2026-27' } as never;
    const allSix = {
      serve: 6, attack: 6, set: 6, defence: 6,
      reception: 6, jump: 6, speed: 6, iq: 6,
    };
    const count = await bulkCreatePlayers(
      'team-1',
      team,
      [
        {
          number: 7,
          fullName: 'Jane Doe',
          dob: '',
          nationality: '',
          licenseNumber: '',
          positionCategory: 'TBD',
          playerPhone: '',
          guardians: [],
          skills: allSix,
        },
        {
          number: 8,
          fullName: 'John Roe',
          dob: '',
          nationality: '',
          licenseNumber: '',
          positionCategory: 'TBD',
          playerPhone: '',
          guardians: [],
          skills: allSix,
        },
      ],
      'coach-uid'
    );

    expect(count).toBe(2);
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith({}, 'teams', 'team-1', 'players');
    const payload = batchSet.mock.calls[0][1];
    expect(payload).toMatchObject({
      number: 7,
      fullName: 'Jane Doe',
      teamName: 'U17',
      ageGroup: 'U17',
      season: '2026-27',
      avgScore: 6,
      level: 'Advanced',
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'coach-uid',
    });
    expect(payload.skills.serve).toEqual({ score: 6, notes: '', priority: false });
    expect(batchSet.mock.calls[1][1]).toMatchObject({ number: 8, fullName: 'John Roe' });
  });

  it('retries the batch commit once on a transient resource-exhausted error', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('quota'), { code: 'resource-exhausted' }))
      .mockResolvedValue(undefined);
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const team = { id: 'team-1', name: 'U17', ageGroup: 'U17', season: '2026-27' } as never;
    const count = await bulkCreatePlayers(
      'team-1',
      team,
      [
        {
          number: 7,
          fullName: 'Jane Doe',
          dob: '',
          nationality: '',
          licenseNumber: '',
          positionCategory: 'TBD',
          playerPhone: '',
          guardians: [],
          skills: { serve: 6, attack: 6, set: 6, defence: 6, reception: 6, jump: 6, speed: 6, iq: 6 },
        },
      ],
      'coach-uid'
    );

    expect(count).toBe(1);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });

  it('rejects a bulk player import above the MAX_IMPORT cap before any write', async () => {
    const batchSet = vi.fn();
    const batchCommit = vi.fn();
    mockWriteBatch.mockReturnValue({ set: batchSet, commit: batchCommit });

    const team = { id: 'team-1', name: 'U17', ageGroup: 'U17', season: '2026-27' } as never;
    const rows = Array.from({ length: 101 }, (_, i) => ({
      number: i,
      fullName: 'x',
      dob: '',
      nationality: '',
      licenseNumber: '',
      positionCategory: 'TBD',
      playerPhone: '',
      guardians: [],
      skills: { serve: null, attack: null, set: null, defence: null, reception: null, jump: null, speed: null, iq: null },
    })) as never;

    await expect(bulkCreatePlayers('team-1', team, rows, 'coach-uid')).rejects.toThrow(/capped at 100 entries/);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('deletes a player and all of their physical test history', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'test-1', ref: 'test-1-ref' },
        { id: 'test-2', ref: 'test-2-ref' },
      ],
    });
    mockDeleteDoc.mockResolvedValue(undefined);

    await deletePlayer('team-1', 'player-1');

    expect(mockDeleteDoc).toHaveBeenCalledWith('test-1-ref');
    expect(mockDeleteDoc).toHaveBeenCalledWith('test-2-ref');
    expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref');
  });

  it('lists players ordered by number, filling in lineup fields absent from older docs', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'player-1', data: () => ({ fullName: 'Test Player' }) }] });

    const { players, lastDoc } = await listPlayers('team-1');

    expect(players).toEqual([
      { id: 'player-1', fullName: 'Test Player', positionCategory: 'TBD', starting: false },
    ]);
    expect(lastDoc).toEqual({ id: 'player-1', data: expect.any(Function) });
  });

  it('keeps the lineup fields already stored on a player doc', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'player-1', data: () => ({ fullName: 'Test Player', positionCategory: 'S', starting: true }) }],
    });

    const { players } = await listPlayers('team-1');

    expect(players[0]).toMatchObject({ positionCategory: 'S', starting: true });
  });

  it('sets a player starting flag on its own', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await setPlayerStarting('team-1', 'player-1', true);

    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { starting: true, updatedAt: 'server-timestamp' });
  });

  it('updates a player position category and starting flag through the contact update', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updatePlayerContact('team-1', 'player-1', { positionCategory: 'MB', starting: true });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ positionCategory: 'MB', starting: true })
    );
  });

  it('updates the player development plan', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);

    await updatePlayerDevelopmentPlan('team-1', 'player-1', {
      shortTermObjectives: [],
      seasonObjectives: [{ objective: 'Make varsity', target: 'Consistent 6+ average', status: 'In progress', coachComment: '' }],
      generalNotes: '',
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({
        developmentPlan: {
          shortTermObjectives: [],
          seasonObjectives: [{ objective: 'Make varsity', target: 'Consistent 6+ average', status: 'In progress', coachComment: '' }],
          generalNotes: '',
        },
      })
    );
  });
});
