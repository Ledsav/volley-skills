// Emulator rehearsal of the club-platform migration (spec §9, §10): a legacy
// single-club tree is migrated under clubs/vcb, then read back through the rules.
import { assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { runMigration } from '../../scripts/migrate/clubPlatformRun.mjs';
import { adminDb, put } from './adminDb.mjs';
import { dbAs, getTestEnv } from './testEnv';

const OPTIONS = { clubId: 'vcb', owner: 'president@x.com', operator: 'boss@x.com', country: 'ES' };
const quiet = () => {};

let db;

beforeEach(async () => {
  const env = await getTestEnv();
  await env.clearFirestore();
  db = adminDb();
  await put(db, {
    'adminAllowlist/Boss@x.com': {},
    'users/u1': { email: 'boss@x.com', role: 'superadmin' },
    'sectionAccess/exercises': { adminEmails: ['Coach@x.com'], migratedAt: 1 },
    'skillGuide/config': { skills: [] },
    'teams/t1': { name: 'U17', club: 'VCB', adminEmails: ['Coach@x.com'], createdBy: 'x' },
    'teams/t1/players/p1': { fullName: 'P', viewerEmails: ['Parent@x.com'] },
    'teams/t1/matches/m1': { status: 'finished' },
    'teams/t1/matches/m1/events/e1': { order: 1 },
    'exercises/x1': { name: 'X' },
    'exercises/x1/diagrams/d1': { order: 0 },
    'trainings/tr1': { name: 'T' },
    'counters/trainings': { lastSequence: 1 },
    'interestSignups/s1': { name: 'L' },
  });
});

afterAll(async () => {
  const env = await getTestEnv();
  await env.cleanup();
});

const migrate = (extra = {}) => runMigration({ source: db, target: db, options: OPTIONS, log: quiet, ...extra });
const exists = async (path) => (await db.doc(path).get()).exists;

describe('club-platform migration', () => {
  it('migrates the legacy tree under clubs/vcb', async () => {
    const result = await migrate();
    expect(result.ok).toBe(true);
    const club = (await db.doc('clubs/vcb').get()).data();
    expect(club).toMatchObject({ name: 'VCB', status: 'active', ownerEmail: 'president@x.com' });
    const role = async (e) => (await db.doc(`clubs/vcb/members/${e}`).get()).data()?.role;
    expect(await role('boss@x.com')).toBe('admin');
    expect(await role('president@x.com')).toBe('admin');
    expect(await role('coach@x.com')).toBe('member');
    expect(await role('parent@x.com')).toBe('member');
    expect(await exists('clubs/vcb/teams/t1/matches/m1/events/e1')).toBe(true);
    expect((await db.doc('clubs/vcb/teams/t1').get()).data()).not.toHaveProperty('club');
    expect(await exists('clubs/vcb/config/skillGuide')).toBe(true);
    expect((await db.doc('users/u1').get()).data()).toEqual({ email: 'boss@x.com' });
    expect(await exists('platformAdmins/boss@x.com')).toBe(true);
    expect(await exists('teams/t1')).toBe(true);
    expect(await exists('interestSignups/s1')).toBe(true);
  });

  it('migrated data works under the rules', async () => {
    await migrate();
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'coach@x.com').doc('clubs/vcb/teams/t1').get());
    await assertSucceeds(dbAs(env, 'parent@x.com').doc('clubs/vcb/teams/t1/players/p1').get());
  });

  it('refuses to run twice without --resume', async () => {
    await migrate();
    await expect(migrate()).rejects.toThrow(/already exists/);
  });

  it('resume writes only what is missing', async () => {
    await migrate();
    await db.doc('clubs/vcb/teams/t1/matches/m1/events/e1').delete();
    const result = await migrate({ resume: true });
    expect(result.written).toBe(1);
    expect(result.ok).toBe(true);
    expect(await exists('clubs/vcb/teams/t1/matches/m1/events/e1')).toBe(true);
  });

  it('a dry run writes nothing', async () => {
    const result = await migrate({ dryRun: true });
    expect(result.written).toBe(0);
    expect(await exists('clubs/vcb')).toBe(false);
  });
});
