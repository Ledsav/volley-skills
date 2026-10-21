import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

async function seedTeamAndPlayer(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await seedClub(env, {
    id: 'club-a',
    admins: ['super@example.com'],
    members: ['coach@example.com', 'parent@example.com', 'coach-a@example.com', 'coach-b@example.com'],
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
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/players/player-1').get());
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/players/player-1').update({ fullName: 'Updated Name' }));
  });

  it('lets the linked viewer read but not write the player', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/players/player-1').get());
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1').update({ fullName: 'Hacked' }));
  });

  it('denies a viewer listed in viewerEmails who is not a club member', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clubs/club-a/teams/team-1/players/player-1').update({ viewerEmails: ['parent@example.com', 'ghost@example.com'] });
    });
    const db = dbAs(env, 'ghost@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1').get());
  });

  it('denies an unrelated user from reading the player', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'stranger@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/players/player-1').get());
  });

  it('denies an admin of one team any access to a player under another team', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-A').set({ name: 'U17 A', adminEmails: ['coach-a@example.com'] });
      await db.doc('clubs/club-a/teams/team-B').set({ name: 'U17 B', adminEmails: ['coach-b@example.com'] });
      await db.doc('clubs/club-a/teams/team-B/players/player-b').set({
        fullName: 'Team B Player',
        viewerEmails: [],
        skills: {
          serve: { score: null }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
          reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
        },
      });
    });

    // coach-a is a legitimate admin — but of the wrong team.
    const coachA = dbAs(env, 'coach-a@example.com');
    await assertFails(coachA.doc('clubs/club-a/teams/team-B/players/player-b').get());
    await assertFails(coachA.doc('clubs/club-a/teams/team-B/players/player-b').update({ fullName: 'Hacked' }));
  });

  it('allows a score within 1-10, denies a score outside that range', async () => {
    const env = await getTestEnv();
    const validSkills = {
      serve: { score: 7 }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const invalidSkills = { ...validSkills, serve: { score: 11 } };

    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/teams/team-1/players/player-1').update({ skills: validSkills }));
    await assertFails(adminDb.doc('clubs/club-a/teams/team-1/players/player-1').update({ skills: invalidSkills }));
  });

  it('validates the block skill score like every other skill', async () => {
    const env = await getTestEnv();
    const base = {
      serve: { score: null }, attack: { score: null }, block: { score: 6 }, set: { score: null }, defence: { score: null },
      reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
    };
    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/teams/team-1/players/player-1').update({ skills: base }));
    await assertFails(
      adminDb.doc('clubs/club-a/teams/team-1/players/player-1').update({ skills: { ...base, block: { score: 0 } } })
    );
  });

  it('lets the team admin delete the player, denies the linked viewer', async () => {
    const env = await getTestEnv();
    const viewerDb = dbAs(env, 'parent@example.com');
    await assertFails(viewerDb.doc('clubs/club-a/teams/team-1/players/player-1').delete());

    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/teams/team-1/players/player-1').delete());
  });

  it('lets a club admin who is NOT in adminEmails read, write, and delete the player', async () => {
    const env = await getTestEnv();
    const superDb = dbAs(env, 'super@example.com');
    await assertSucceeds(superDb.doc('clubs/club-a/teams/team-1/players/player-1').get());
    await assertSucceeds(superDb.doc('clubs/club-a/teams/team-1/players/player-1').update({ fullName: 'Super Edit' }));
    await assertSucceeds(superDb.doc('clubs/club-a/teams/team-1/players/player-1').delete());
  });

  it('lets the team admin mark a player as left and list who is due for deletion', async () => {
    const env = await getTestEnv();
    const coach = dbAs(env, 'coach@example.com');
    await assertSucceeds(coach.doc('clubs/club-a/teams/team-1/players/player-1').update({ leftClubAt: '2025-06-01' }));
    await assertSucceeds(
      coach.collection('clubs/club-a/teams/team-1/players').where('leftClubAt', '<=', '2025-10-14').orderBy('leftClubAt').limit(50).get()
    );

    const stranger = dbAs(env, 'stranger@example.com');
    await assertFails(stranger.doc('clubs/club-a/teams/team-1/players/player-1').update({ leftClubAt: null }));
    await assertFails(
      stranger.collection('clubs/club-a/teams/team-1/players').where('leftClubAt', '<=', '2025-10-14').orderBy('leftClubAt').limit(50).get()
    );
  });
});
