import { assertFails } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, OPERATOR, seedClub, seedPlatformAdmin } from './testEnv';

// The single-club model lived at the top level. Its data stays readable by no
// one until it is deleted (the grace period of the club-platform migration).
const RETIRED = [
  'adminAllowlist/admin-a@example.com',
  'sectionAccess/exercises',
  'skillGuide/config',
  'physicalTestGuide/config',
  'exercises/x1',
  'exercises/x1/diagrams/d1',
  'trainings/tr1',
  'counters/trainings',
  'teams/team-1',
  'teams/team-1/players/p1',
  'teams/team-1/players/p1/physicalTests/t1',
  'teams/team-1/calendar/s1',
  'teams/team-1/testingSessions/ts1',
  'teams/team-1/testingSessions/ts1/entries/e1',
  'teams/team-1/matches/m1',
  'teams/team-1/matches/m1/events/ev1',
  'teams/team-1/awards/season',
  'teams/team-1/scoutProfile/usage',
];

describe('firestore rules smoke test', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('denies all access by default to an unauthenticated user', async () => {
    const env = await getTestEnv();
    const db = env.unauthenticatedContext().firestore();
    await assertFails(db.doc('anything/doc').get());
  });

  it('denies every retired top-level path, even to a club admin, a team admin or the operator', async () => {
    const env = await getTestEnv();
    const ADMIN = 'admin-a@example.com';
    const COACH = 'coach-a@example.com';
    await seedClub(env, { id: 'club-a', admins: [ADMIN], members: [COACH] });
    await seedPlatformAdmin(env, OPERATOR);
    // Old-model grants: an allowlisted superadmin, a team admin and section admin by email.
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      for (const path of RETIRED) await db.doc(path).set({ adminEmails: [COACH], viewerEmails: [COACH] });
    });
    for (const who of [ADMIN, COACH, OPERATOR]) {
      const db = dbAs(env, who);
      for (const path of RETIRED) {
        await assertFails(db.doc(path).get());
        await assertFails(db.doc(path).set({ adminEmails: [who] }, { merge: true }));
      }
      await assertFails(db.collection('teams').where('adminEmails', 'array-contains', who).get());
    }
  });
});
