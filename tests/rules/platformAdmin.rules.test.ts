import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import {
  clubTreePaths,
  dbAs,
  getTestEnv,
  OPERATOR,
  seedClub,
  seedClubTree,
  seedPlatformAdmin,
  serverTimestamp,
} from './testEnv';

// The platform operator runs the platform but is blind to club data: it reads a
// club's doc, its acceptances and its statusLog, nothing else.
const ADMIN_A = 'admin-a@example.com';
const COACH_A = 'coach-a@example.com';
const OTHER_OPERATOR = 'operator-2@example.com';

const PATHS = clubTreePaths('club-a', 'team-1', ADMIN_A);
const OPERATOR_VISIBLE = ['clubs/club-a', 'clubs/club-a/acceptances/v1', 'clubs/club-a/statusLog/l1'];

describe('platform admin (operator) isolation', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedPlatformAdmin(env, OPERATOR);
    await seedPlatformAdmin(env, OTHER_OPERATOR);
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('interestSignups/s-1').set({
        name: 'Jamie Coach', email: 'jamie@example.com', role: 'coach', reviewed: false, createdAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  describe('when not a member of the club', () => {
    beforeEach(async () => {
      const env = await getTestEnv();
      await seedClub(env, {
        id: 'club-a',
        admins: [ADMIN_A],
        members: [COACH_A],
        sections: { exercises: [COACH_A], trainings: [COACH_A], guides: [COACH_A] },
      });
      await seedClubTree(env, 'club-a', 'team-1', [COACH_A]);
    });

    it('cannot read anything inside a club', async () => {
      const env = await getTestEnv();
      const op = dbAs(env, OPERATOR);
      const admin = dbAs(env, ADMIN_A);
      for (const path of PATHS) {
        // Control: the doc exists and a club admin of an active club reads it.
        await assertSucceeds(admin.doc(path).get());
        if (OPERATOR_VISIBLE.includes(path)) await assertSucceeds(op.doc(path).get());
        else await assertFails(op.doc(path).get());
      }
      for (const col of ['teams', 'exercises', 'trainings', 'config', 'sectionAccess', 'counters']) {
        await assertFails(op.collection(`clubs/club-a/${col}`).get());
      }
    });

    it('cannot list members or run the members collection-group query for another email', async () => {
      const env = await getTestEnv();
      const op = dbAs(env, OPERATOR);
      await assertFails(op.collection('clubs/club-a/members').get());
      await assertFails(op.collectionGroup('members').where('email', '==', ADMIN_A).get());
      await assertFails(op.collectionGroup('members').get());
      // Control: its own (empty) membership query is allowed.
      await assertSucceeds(op.collectionGroup('members').where('email', '==', OPERATOR).get());
    });

    it('cannot create its own member doc in a club', async () => {
      const env = await getTestEnv();
      const member = (addedBy: string) => ({
        email: OPERATOR,
        clubId: 'club-a',
        role: 'admin',
        addedBy,
        addedAt: serverTimestamp(),
      });
      await assertFails(dbAs(env, OPERATOR).doc(`clubs/club-a/members/${OPERATOR}`).set(member(OPERATOR)));
      // Control: the same valid doc is accepted from a club admin.
      await assertSucceeds(dbAs(env, ADMIN_A).doc(`clubs/club-a/members/${OPERATOR}`).set(member(ADMIN_A)));
    });

    it('cannot write a team doc', async () => {
      const env = await getTestEnv();
      const op = dbAs(env, OPERATOR);
      const newTeam = (uid: string) => ({ name: 'U19', adminEmails: [OPERATOR], createdBy: uid });
      await assertFails(op.doc('clubs/club-a/teams/team-2').set(newTeam(`uid-${OPERATOR}`)));
      await assertFails(op.doc('clubs/club-a/teams/team-1').update({ name: 'Renamed' }));
      await assertFails(op.doc('clubs/club-a/teams/team-1').delete());
      // Control: a club admin creates the same team doc and renames the seeded one.
      const admin = dbAs(env, ADMIN_A);
      await assertSucceeds(admin.doc('clubs/club-a/teams/team-2').set(newTeam(`uid-${ADMIN_A}`)));
      await assertSucceeds(admin.doc('clubs/club-a/teams/team-1').update({ name: 'Renamed' }));
    });

    it('cannot edit the club profile', async () => {
      const env = await getTestEnv();
      await assertFails(dbAs(env, OPERATOR).doc('clubs/club-a').update({ name: 'Operator name' }));
      // Control: a club admin can.
      await assertSucceeds(dbAs(env, ADMIN_A).doc('clubs/club-a').update({ name: 'Operator name' }));
    });
  });

  it('can read its own platformAdmins doc only; nobody can write platformAdmins', async () => {
    const env = await getTestEnv();
    const op = dbAs(env, OPERATOR);
    await assertSucceeds(op.doc(`platformAdmins/${OPERATOR}`).get());
    await assertFails(op.doc(`platformAdmins/${OTHER_OPERATOR}`).get());
    await assertFails(op.collection('platformAdmins').get());
    await assertFails(op.doc(`platformAdmins/${OPERATOR}`).set({ note: 'x' }));
    await assertFails(op.doc('platformAdmins/new@example.com').set({}));
    await assertFails(op.doc(`platformAdmins/${OTHER_OPERATOR}`).delete());
    await assertFails(dbAs(env, ADMIN_A).doc(`platformAdmins/${ADMIN_A}`).set({}));
    await assertFails(dbAs(env, ADMIN_A).doc(`platformAdmins/${OPERATOR}`).get());
  });

  it('reads and updates interestSignups; a club admin cannot', async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-a', admins: [ADMIN_A] });
    const op = dbAs(env, OPERATOR);
    await assertSucceeds(op.doc('interestSignups/s-1').get());
    await assertSucceeds(op.collection('interestSignups').get());
    await assertSucceeds(op.doc('interestSignups/s-1').update({ reviewed: true }));

    const admin = dbAs(env, ADMIN_A);
    await assertFails(admin.doc('interestSignups/s-1').get());
    await assertFails(admin.collection('interestSignups').get());
    await assertFails(admin.doc('interestSignups/s-1').update({ reviewed: true }));
    await assertFails(admin.doc('interestSignups/s-1').delete());
  });

  it('reads club data only through membership when it is also a member', async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-a', admins: [ADMIN_A], members: [OPERATOR] });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: [OPERATOR], createdBy: 'seed' });
      await db.doc('clubs/club-a/teams/team-2').set({ name: 'U19', adminEmails: [ADMIN_A], createdBy: 'seed' });
    });
    const op = dbAs(env, OPERATOR);
    await assertSucceeds(op.doc('clubs/club-a/teams/team-1').get());
    // Being the operator adds nothing on top of the membership.
    await assertFails(op.doc('clubs/club-a/teams/team-2').get());
  });
});
