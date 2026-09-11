import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeamPlayerAndTest(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('sectionAccess/exercises').set({ adminEmails: [] });
    await db.doc('sectionAccess/trainings').set({ adminEmails: [] });
    await db.doc('sectionAccess/guides').set({ adminEmails: [] });
    await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    await db.doc('teams/team-1/players/player-1').set({
      fullName: 'Test Player',
      viewerEmails: ['parent@example.com'],
      skills: {
        serve: { score: null }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
        reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
      },
    });
    await db.doc('teams/team-1/players/player-1/physicalTests/test-1').set({
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
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/players/player-1/physicalTests').add({
        testType: 'growth',
        heightCm: 160,
        bodyMassKg: 50,
        date: '2026-09-07',
      })
    );
  });

  it('lets the linked viewer read but not write physical tests', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
    await assertFails(db.doc('teams/team-1/players/player-1/physicalTests/test-1').update({ bestCm: 99 }));
  });

  it('denies an unrelated user from reading physical tests', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/players/player-1/physicalTests/test-1').get());
  });

  it('lets the team admin delete a physical test, denies the linked viewer', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('teams/team-1/players/player-1/physicalTests/test-1').delete());

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1/physicalTests/test-1').delete());
  });
});
