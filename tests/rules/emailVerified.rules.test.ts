import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, OPERATOR, seedClub, seedClubTree, seedPlatformAdmin, serverTimestamp } from './testEnv';

// Email-link sign-in needs the Email/Password provider on, so anyone can create a
// password account for an address that has none yet. Its token carries that email
// unverified; the rules must not treat it as the person who owns the address.
const ADMIN_A = 'admin-a@example.com';
const COACH_A = 'coach-a@example.com';

describe('unverified email tokens', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, { id: 'club-a', admins: [ADMIN_A], members: [COACH_A] });
    await seedClubTree(env, 'club-a', 'team-1', [ADMIN_A]);
    await seedPlatformAdmin(env, OPERATOR);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('a verified member reads their club (control)', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, COACH_A).doc('clubs/club-a').get());
  });

  it('refuses a member email without verification', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, COACH_A, { verified: false });
    await assertFails(db.doc('clubs/club-a').get());
    await assertFails(db.doc(`clubs/club-a/members/${COACH_A}`).get());
    await assertFails(db.collectionGroup('members').where('email', '==', COACH_A).get());
  });

  it('refuses a club admin email without verification', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, ADMIN_A, { verified: false });
    await assertFails(db.doc('clubs/club-a/teams/team-1').get());
    await assertFails(db.doc('clubs/club-a/members/new@example.com').set({
      email: 'new@example.com', clubId: 'club-a', role: 'admin', addedBy: ADMIN_A, addedAt: serverTimestamp(),
    }));
  });

  it('refuses the operator email without verification', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, OPERATOR, { verified: false });
    await assertFails(db.doc(`platformAdmins/${OPERATOR}`).get());
    await assertFails(db.collection('clubs').get());
    await assertFails(db.collection('interestSignups').get());
  });

  it('refuses a users doc without verification', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, COACH_A, { verified: false });
    await assertFails(db.doc(`users/uid-${COACH_A}`).set({ email: COACH_A, createdAt: serverTimestamp() }));
  });
});
