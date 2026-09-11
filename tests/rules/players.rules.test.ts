import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeamAndPlayer(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('adminAllowlist/super@example.com').set({});
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

  it('denies an admin of one team any access to a player under another team', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('teams/team-A').set({ name: 'U17 A', adminEmails: ['coach-a@example.com'] });
      await db.doc('teams/team-B').set({ name: 'U17 B', adminEmails: ['coach-b@example.com'] });
      await db.doc('teams/team-B/players/player-b').set({
        fullName: 'Team B Player',
        viewerEmails: [],
        skills: {
          serve: { score: null }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
          reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
        },
      });
    });

    // coach-a is a legitimate admin — but of the wrong team.
    const coachA = env.authenticatedContext('coach-a-uid', { email: 'coach-a@example.com' }).firestore();
    await assertFails(coachA.doc('teams/team-B/players/player-b').get());
    await assertFails(coachA.doc('teams/team-B/players/player-b').update({ fullName: 'Hacked' }));
  });

  it('allows a score within 1-10, denies a score outside that range', async () => {
    const env = await getTestEnv();
    const validSkills = {
      serve: { score: 7 }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const invalidSkills = { ...validSkills, serve: { score: 11 } };

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1').update({ skills: validSkills }));
    await assertFails(adminDb.doc('teams/team-1/players/player-1').update({ skills: invalidSkills }));
  });

  it('validates the block skill score like every other skill', async () => {
    const env = await getTestEnv();
    const base = {
      serve: { score: null }, attack: { score: null }, block: { score: 6 }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1').update({ skills: base }));
    await assertFails(
      adminDb.doc('teams/team-1/players/player-1').update({ skills: { ...base, block: { score: 0 } } })
    );
  });

  it('lets the team admin delete the player, denies the linked viewer', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('teams/team-1/players/player-1').delete());

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1/players/player-1').delete());
  });

  it('lets a super-admin who is NOT in adminEmails read, write, and delete the player', async () => {
    const env = await getTestEnv();
    const superDb = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
    await assertSucceeds(superDb.doc('teams/team-1/players/player-1').get());
    await assertSucceeds(superDb.doc('teams/team-1/players/player-1').update({ fullName: 'Super Edit' }));
    await assertSucceeds(superDb.doc('teams/team-1/players/player-1').delete());
  });
});
