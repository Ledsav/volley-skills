import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeamAndPlayer(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    await db.doc('teams/team-1/players/player-1').set({
      fullName: 'Test Player',
      viewerEmails: ['parent@example.com'],
      skills: {
        serve: { score: null }, attack: { score: null }, set: { score: null }, defence: { score: null },
        reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
      },
    });
  });
}

describe('player rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeamAndPlayer(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and update the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1').get());
    await assertSucceeds(db.doc('teams/team-1/players/player-1').update({ fullName: 'Updated Name' }));
  });

  it('lets the linked viewer read but not write the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/players/player-1').get());
    await assertFails(db.doc('teams/team-1/players/player-1').update({ fullName: 'Hacked' }));
  });

  it('denies an unrelated user from reading the player', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/players/player-1').get());
  });

  it('allows a score within 1-10, denies a score outside that range', async () => {
    const env = await getTestEnv();
    const validSkills = {
      serve: { score: 7 }, attack: { score: null }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const invalidSkills = { ...validSkills, serve: { score: 11 } };

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1').update({ skills: validSkills }));
    await assertFails(adminDb.doc('teams/team-1/players/player-1').update({ skills: invalidSkills }));
  });
});
