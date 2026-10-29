process.env.TZ = 'Europe/Rome';

import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import {
  bulkCreatePlayers,
  createPlayer,
  deletePlayer,
  listPlayers,
  listPlayersDueForDeletion,
  recordPlayerConsent,
  setPlayerLeftClub,
  setPlayerStarting,
  updatePlayerContact,
  updatePlayerDevelopmentPlan,
} from './playersApi';
import { deleteCollection } from '../firebase/deleteCollection';
import { erasePlayerFootprint } from './playerFootprintApi';
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
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  serverTimestamp: () => 'server-timestamp',
  doc: vi.fn(() => 'doc-ref'),
  getDoc: vi.fn(),
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  writeBatch: mockWriteBatch,
}));

vi.mock('../firebase/config', () => ({ db: {} }));
vi.mock('../firebase/deleteCollection');
vi.mock('./playerFootprintApi');

const team: Team = {
  id: 'team-1',
  name: 'U17',
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
  // Retry tests run withBackoff's jittered sleeps on fake timers, so they
  // stay instant and don't depend on its default delays.
  afterEach(() => vi.useRealTimers());

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
      serve: 6, attack: 6, block: 6, set: 6, defence: 6,
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
          shirtSize: '',
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
          shirtSize: '',
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
    expect(mockCollection).toHaveBeenCalledWith({}, 'clubs', 'club-1', 'teams', 'team-1', 'players');
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
    vi.useFakeTimers();
    const pending = bulkCreatePlayers(
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
          shirtSize: '',
          playerPhone: '',
          guardians: [],
          skills: { serve: 6, attack: 6, block: 6, set: 6, defence: 6, reception: 6, jump: 6, speed: 6, iq: 6 },
        },
      ],
      'coach-uid'
    );
    await vi.runAllTimersAsync();
    const count = await pending;

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
      skills: { serve: null, attack: null, block: null, set: null, defence: null, reception: null, jump: null, speed: null, iq: null },
    })) as never;

    await expect(bulkCreatePlayers('team-1', team, rows, 'coach-uid')).rejects.toThrow(/capped at 100 entries/);
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it('deletes a player after their footprint and physical test history', async () => {
    const order: string[] = [];
    vi.mocked(erasePlayerFootprint).mockImplementation(async () => {
      order.push('footprint');
    });
    vi.mocked(deleteCollection).mockImplementation(async () => {
      order.push('tests');
    });
    mockDeleteDoc.mockImplementation(async () => {
      order.push('player');
    });

    await deletePlayer('team-1', 'player-1');

    expect(mockCollection).toHaveBeenCalledWith({}, 'clubs', 'club-1', 'teams', 'team-1', 'players', 'player-1', 'physicalTests');
    expect(erasePlayerFootprint).toHaveBeenCalledWith('team-1', 'player-1');
    expect(order).toEqual(['footprint', 'tests', 'player']);
  });

  it('lists players ordered by number, filling in lineup + skill fields absent from older docs', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'player-1', data: () => ({ fullName: 'Test Player' }) }] });

    const { players, lastDoc } = await listPlayers('team-1');

    expect(players[0]).toMatchObject({
      id: 'player-1',
      fullName: 'Test Player',
      positionCategory: 'TBD',
      starting: false,
    });
    expect(players[0].skills.block).toEqual({ score: null, notes: '', priority: false });
    expect(Object.keys(players[0].skills)).toHaveLength(9);
    expect(lastDoc).toEqual({ id: 'player-1', data: expect.any(Function) });
  });

  it('adds the missing block skill to an 8-skill doc without disturbing the others', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        {
          id: 'player-1',
          data: () => ({
            fullName: 'Test Player',
            skills: {
              serve: { score: 7, notes: 'jump serve', priority: true },
              attack: { score: 5, notes: '', priority: false },
              set: { score: null, notes: '', priority: false },
              defence: { score: null, notes: '', priority: false },
              reception: { score: null, notes: '', priority: false },
              jump: { score: null, notes: '', priority: false },
              speed: { score: null, notes: '', priority: false },
              iq: { score: null, notes: '', priority: false },
            },
          }),
        },
      ],
    });

    const { players } = await listPlayers('team-1');

    expect(players[0].skills.serve).toEqual({ score: 7, notes: 'jump serve', priority: true });
    expect(players[0].skills.block).toEqual({ score: null, notes: '', priority: false });
  });

  it('defaults shirtSize to "" for docs that predate it, and keeps a stored one', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'player-1', data: () => ({ fullName: 'Old Player' }) },
        { id: 'player-2', data: () => ({ fullName: 'New Player', shirtSize: 'L' }) },
      ],
    });

    const { players } = await listPlayers('team-1');

    expect(players[0].shirtSize).toBe('');
    expect(players[1].shirtSize).toBe('L');
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

  it('records guardian consent with today and the confirming admin', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    const consent = await recordPlayerConsent('team-1', 'player-1', 'coach@example.com');
    expect(consent).toEqual({ given: true, date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), confirmedBy: 'coach@example.com' });
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { consent, updatedAt: 'server-timestamp' });
  });

  it('records consent with the local date', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-14T22:30:00Z'));
    expect(await recordPlayerConsent('team-1', 'player-1', 'coach@example.com')).toEqual({
      given: true,
      date: '2026-10-15',
      confirmedBy: 'coach@example.com',
    });
    expect((await recordPlayerConsent('team-1', 'player-1', 'coach@example.com', '2026-01-02')).date).toBe('2026-01-02');
  });

  it('marks a player as having left the club, and back', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await setPlayerLeftClub('team-1', 'player-1', '2026-10-14');
    expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { leftClubAt: '2026-10-14', updatedAt: 'server-timestamp' });
    await setPlayerLeftClub('team-1', 'player-1', null);
    expect(mockUpdateDoc).toHaveBeenLastCalledWith('doc-ref', { leftClubAt: null, updatedAt: 'server-timestamp' });
  });

  it('lists players who left on or before the cutoff, bounded', async () => {
    mockGetDocs.mockResolvedValue({ docs: [{ id: 'player-1', data: () => ({ fullName: 'Old Player', leftClubAt: '2025-09-01' }) }] });
    const due = await listPlayersDueForDeletion('team-1', '2025-10-14');
    expect(due[0]).toMatchObject({ id: 'player-1', leftClubAt: '2025-09-01' });
    expect(mockQuery).toHaveBeenLastCalledWith(
      'players-collection',
      { type: 'where', args: ['leftClubAt', '<=', '2025-10-14'] },
      { type: 'orderBy', args: ['leftClubAt'] },
      { type: 'limit', args: [50] }
    );
  });
});
