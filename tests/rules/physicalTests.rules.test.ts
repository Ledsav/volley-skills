import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

async function seedTeamPlayerAndTest(env: Awaited<ReturnType<typeof getTestEnv>>, growthTestsEnabled = true) {
  await seedClub(env, {
    id: 'club-a',
    admins: ['super@example.com'],
    members: ['coach@example.com', 'parent@example.com', 'plain@example.com'],
    growthTestsEnabled,
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    await db.doc('clubs/club-a/teams/team-1/players/player-1').set({
      fullName: 'Test Player',
      viewerEmails: ['parent@example.com'],
      skills: {
        serve: { score: null }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
        reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
      },
    });
    await db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').set({
      testType: 'cmj',
      attemptsCm: [30, 34, 32],
      bestCm: 34,
      date: '2026-09-07',
    });
    await db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/growth-1').set({
      testType: 'growth',
      heightCm: 160,
      bodyMassKg: 50,
      date: '2026-09-07',
    });
  });
}

const TESTS = 'clubs/club-a/teams/team-1/players/player-1/physicalTests';
const growthTest = { testType: 'growth', heightCm: 161, bodyMassKg: 51, date: '2026-09-08' };
const cmjTest = { testType: 'cmj', attemptsCm: [31, 35, 33], bestCm: 35, date: '2026-09-08' };

describe('physicalTests rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamPlayerAndTest(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and write physical tests', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/teams/team-1/players/player-1/physicalTests').add({
        testType: 'growth',
        heightCm: 160,
        bodyMassKg: 50,
        date: '2026-09-07',
      })
    );
  });

  it('lets the linked viewer read but not write physical tests', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').update({ bestCm: 99 }));
  });

  it('denies an unrelated user from reading physical tests', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'stranger@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').get());
  });

  it('lets the team admin delete a physical test, denies the linked viewer', async () => {
    const env = await getTestEnv();
    const viewerDb = dbAs(env, 'parent@example.com');
    await assertFails(viewerDb.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').delete());

    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').delete());
  });

  it('denies a club member who is neither viewer nor team admin', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'plain@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').delete());
  });

  it('refuses a growth test when the club has growth tests off', async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamPlayerAndTest(env, false);
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.collection(TESTS).add(growthTest));
    await assertFails(db.doc(`${TESTS}/growth-1`).update({ heightCm: 162 }));
    // Turning an existing test into a growth test is refused too.
    await assertFails(db.doc(`${TESTS}/test-1`).update({ ...growthTest }));
    // Other test types are unaffected.
    await assertSucceeds(db.collection(TESTS).add(cmjTest));
    await assertSucceeds(db.doc(`${TESTS}/test-1`).update({ bestCm: 35 }));
  });

  it('refuses relabelling an existing growth test while growth tests are off', async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamPlayerAndTest(env, false);
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc(`${TESTS}/growth-1`).update({ testType: 'cmj', heightCm: 170 }));
    // Deleting it stays allowed (see the delete test below).
  });

  it('lets a growth test be relabelled while growth tests are on', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc(`${TESTS}/growth-1`).update({ testType: 'cmj', heightCm: 170 }));
  });

  it('accepts growth tests when the club has growth tests on', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.collection(TESTS).add(growthTest));
    await assertSucceeds(db.doc(`${TESTS}/growth-1`).update({ heightCm: 162 }));
  });

  it('still lets a team admin delete an existing growth test when growth tests are off', async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamPlayerAndTest(env, false);
    await assertFails(dbAs(env, 'parent@example.com').doc(`${TESTS}/growth-1`).delete());
    await assertSucceeds(dbAs(env, 'coach@example.com').doc(`${TESTS}/growth-1`).delete());
  });

  it('denies a viewer listed in viewerEmails who is not a club member', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clubs/club-a/teams/team-1/players/player-1').update({ viewerEmails: ['parent@example.com', 'ghost@example.com'] });
    });
    const db = dbAs(env, 'ghost@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1/physicalTests/test-1').get());
  });
});
