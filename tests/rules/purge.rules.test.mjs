// Emulator tests of the ops scripts' cores: purging an ended club to a tombstone
// (spec §7.4) and dropping the legacy top-level collections (spec §9.6).
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { countUnder } from '../../scripts/migrate/firestoreTree.mjs';
import { dropLegacy } from '../../scripts/migrate/legacy.mjs';
import { purgeClub } from '../../scripts/ops/purge.mjs';
import { adminDb, put } from './adminDb.mjs';
import { getTestEnv, seedClub, seedClubTree } from './testEnv';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY);
const quiet = () => {};

let db;

beforeEach(async () => {
  const env = await getTestEnv();
  await env.clearFirestore();
  db = adminDb();
});

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

describe('purgeClub', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await seedClub(env, {
      id: 'gone',
      status: 'terminating',
      admins: ['a@x.com'],
      termination: { effectiveAt: ago(31), retrievalEndsAt: ago(1) },
    });
    await seedClubTree(env, 'gone', 't1', ['a@x.com']);
    await seedClub(env, { id: 'kept', admins: ['k@x.com'] });
    await seedClubTree(env, 'kept', 't1', ['k@x.com']);
  });

  it('purges a club whose retrieval window ended down to a tombstone', async () => {
    const summary = await purgeClub(db, 'gone', new Date(), quiet);
    expect(summary.teams).toBeGreaterThan(0);
    const tomb = (await db.doc('clubs/gone').get()).data();
    expect(Object.keys(tomb).sort()).toEqual(
      ['name', 'country', 'ownerEmail', 'createdAt', 'status', 'statusChangedAt', 'legal'].sort(),
    );
    expect(tomb.status).toBe('deleted');
    expect(tomb.statusChangedAt).toBeInstanceOf(Timestamp);
    expect((await db.doc('clubs/gone/acceptances/v1').get()).exists).toBe(true);
    expect((await db.doc('clubs/gone/statusLog/l1').get()).exists).toBe(true);
    const log = await db.collection('clubs/gone/statusLog').get();
    expect(log.size).toBe(2);
    expect(log.docs.map((d) => d.data()).find((e) => e.to === 'deleted')).toMatchObject({
      from: 'terminating', reason: 'Data purged', by: 'purge-script',
    });
    for (const sub of ['teams', 'members', 'exercises', 'trainings', 'counters', 'config', 'sectionAccess']) {
      expect(await countUnder(db, `clubs/gone/${sub}`)).toBe(0);
    }
    expect(await countUnder(db, 'clubs/kept/teams')).toBeGreaterThan(0);
  });

  it('refuses an active club and deletes nothing', async () => {
    await expect(purgeClub(db, 'kept', new Date(), quiet)).rejects.toThrow(/club is active/);
    expect((await db.doc('clubs/kept/teams/t1').get()).exists).toBe(true);
  });
});

describe('dropLegacy', () => {
  it('drops the legacy collections and nothing else', async () => {
    await put(db, {
      'teams/t1': { name: 'U17' },
      'teams/t1/players/p1': { fullName: 'P' },
      'adminAllowlist/a@x.com': {},
      'skillGuide/config': { skills: [] },
      'users/u1': { email: 'u@x.com' },
      'interestSignups/s1': { name: 'L' },
      'clubs/vcb': { createdAt: Timestamp.fromDate(ago(20)) },
    });
    const deleted = await dropLegacy(db, quiet);
    expect(deleted.teams).toBe(2);
    expect(await countUnder(db, 'teams')).toBe(0);
    expect(await countUnder(db, 'adminAllowlist')).toBe(0);
    expect(await countUnder(db, 'skillGuide')).toBe(0);
    expect((await db.doc('users/u1').get()).exists).toBe(true);
    expect((await db.doc('interestSignups/s1').get()).exists).toBe(true);
    expect((await db.doc('clubs/vcb').get()).exists).toBe(true);
  });
});
