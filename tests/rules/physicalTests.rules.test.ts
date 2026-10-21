import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

async function seedTeamPlayerAndTest(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await seedClub(env, { id: 'club-a', admins: ['super@example.com'], members: ['coach@example.com', 'parent@example.com'] });
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
  });
}

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
});
