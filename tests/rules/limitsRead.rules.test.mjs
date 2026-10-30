// Emulator test of the size-cap check's read side (scripts/ops/limitsRead.mjs) with its report.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { readForLimits } from '../../scripts/ops/limitsRead.mjs';
import { limitsReport } from '../../scripts/ops/limitsReport.mjs';
import { LIMITS } from '../../src/types/limitValues.js';
import { adminDb, put } from './adminDb.mjs';
import { getTestEnv } from './testEnv';

let db;

beforeEach(async () => {
  const env = await getTestEnv();
  await env.clearFirestore();
  db = adminDb();
  await put(db, {
    'clubs/c1': { name: 'Club One', status: 'active' },
    'clubs/c1/members/coach@example.com': { email: 'coach@example.com', role: 'admin' },
    'clubs/c1/teams/t1': { name: 'U17', adminEmails: ['coach@example.com'] },
    'clubs/c1/teams/t1/players/p1': { fullName: 'Ada Example', guardians: Array.from({ length: LIMITS.guardians + 1 }, () => ({ relation: 'other', name: 'G', phone: '', email: '' })) },
    'clubs/c1/teams/t1/players/p1/physicalTests/x1': { testType: 'cmj', notes: 'ok' },
    'clubs/c1/teams/t1/matches/m1': { date: '2026-10-30', opponent: 'Rivals', roster: [] },
    'clubs/c1/teams/t1/matches/m1/events/e1': { type: 'point', order: 1 },
    'clubs/c1/teams/t1/scoutProfile/usage': { players: {} },
    'clubs/c1/config/skillGuide': { skills: [] },
    'clubs/c1/exercises/e1': { name: 'Serve' },
    'clubs/c2/trainings/t1': { name: 'Session', exercises: [], exerciseIds: [] },
    'teams/legacy': { name: 'old' },
  });
});

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

describe('readForLimits', () => {
  it('reads every capped club document, and no events, members, club profiles or legacy data', async () => {
    const { docs, reads, clubs } = await readForLimits(db);
    expect(clubs).toBe(2);
    expect(docs.map((d) => d.path).sort()).toEqual([
      'clubs/c1/config/skillGuide',
      'clubs/c1/exercises/e1',
      'clubs/c1/teams/t1',
      'clubs/c1/teams/t1/matches/m1',
      'clubs/c1/teams/t1/players/p1',
      'clubs/c1/teams/t1/players/p1/physicalTests/x1',
      'clubs/c1/teams/t1/scoutProfile/usage',
      'clubs/c2/trainings/t1',
    ]);
    expect(reads).toBeGreaterThanOrEqual(docs.length);

    const report = limitsReport(docs);
    expect(report.over).toBe(1);
    expect(report.clubs.c1.checks['player.guardians.count']).toMatchObject({ over: 1, paths: ['clubs/c1/teams/t1/players/p1'] });
  });

  it('reads only the given clubs', async () => {
    const { docs } = await readForLimits(db, { clubIds: ['c2'] });
    expect(docs.map((d) => d.path)).toEqual(['clubs/c2/trainings/t1']);
  });

  it('stops at the read budget', async () => {
    await expect(readForLimits(db, { maxReads: 3 })).rejects.toThrow(/read budget of 3/);
  });
});
