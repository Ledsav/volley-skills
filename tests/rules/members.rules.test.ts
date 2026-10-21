import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dbAs, getTestEnv, seedClub, serverTimestamp, type SeedClubOptions } from './testEnv';

const ADMIN = 'admin-a@example.com';
const COACH = 'coach-a@example.com';
const CLUB_A: SeedClubOptions = { id: 'club-a', admins: [ADMIN], ownerEmail: ADMIN, members: [COACH] };

function newMember(overrides: Record<string, unknown> = {}) {
  return {
    email: 'new@example.com',
    clubId: 'club-a',
    role: 'member',
    addedBy: ADMIN,
    addedAt: serverTimestamp(),
    ...overrides,
  };
}

describe('club members rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, CLUB_A);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('reads its own member docs across clubs with a collection-group query', async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-b', admins: ['admin-b@example.com'], members: [COACH] });
    const db = dbAs(env, COACH);

    const mine = await assertSucceeds(db.collectionGroup('members').where('email', '==', COACH).get());
    expect(mine.docs.map((d) => d.ref.path).sort()).toEqual([
      `clubs/club-a/members/${COACH}`,
      `clubs/club-b/members/${COACH}`,
    ]);

    await assertFails(db.collectionGroup('members').where('email', '==', ADMIN).get());
  });

  it('matches a mixed-case sign-in email to the lowercased member doc', async () => {
    const env = await getTestEnv();
    await assertSucceeds(dbAs(env, 'Coach-A@Example.com').doc('clubs/club-a').get());
  });

  it("lets members of an active club list the club's members; outsiders cannot", async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-b', admins: ['admin-b@example.com'] });

    await assertSucceeds(dbAs(env, COACH).collection('clubs/club-a/members').get());
    await assertSucceeds(dbAs(env, ADMIN).collection('clubs/club-a/members').get());
    await assertFails(dbAs(env, 'outsider@example.com').collection('clubs/club-a/members').get());
    await assertFails(dbAs(env, 'admin-b@example.com').collection('clubs/club-a/members').get());
    await assertFails(env.unauthenticatedContext().firestore().collection('clubs/club-a/members').get());
  });

  it('lets an active club admin add a member with a valid shape', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, ADMIN);
    const members = db.collection('clubs/club-a/members');

    // Doc id differs from email.
    await assertFails(members.doc('other@example.com').set(newMember()));
    // Upper-case id (and email to match it).
    await assertFails(members.doc('New@example.com').set(newMember({ email: 'New@example.com' })));
    // Another club's id.
    await assertFails(members.doc('new@example.com').set(newMember({ clubId: 'club-b' })));
    // Unknown role.
    await assertFails(members.doc('new@example.com').set(newMember({ role: 'owner' })));
    // Extra key.
    await assertFails(members.doc('new@example.com').set(newMember({ extra: true })));
    // addedBy someone else.
    await assertFails(members.doc('new@example.com').set(newMember({ addedBy: 'someone@example.com' })));

    await assertSucceeds(members.doc('new@example.com').set(newMember()));
  });

  it("refuses another club's admin writing this club's members", async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-b', admins: ['admin-b@example.com'] });
    const db = dbAs(env, 'admin-b@example.com');

    await assertFails(
      db.doc('clubs/club-a/members/new@example.com').set(newMember({ addedBy: 'admin-b@example.com' }))
    );
    await assertFails(db.doc(`clubs/club-a/members/${COACH}`).update({ role: 'admin' }));
    await assertFails(db.doc(`clubs/club-a/members/${COACH}`).delete());
  });

  it('refuses member writes from a plain member, including self-promotion', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, COACH);

    await assertFails(db.doc(`clubs/club-a/members/${COACH}`).update({ role: 'admin' }));
    await assertFails(
      db.doc('clubs/club-a/members/new@example.com').set(newMember({ addedBy: COACH }))
    );
    await assertFails(db.doc(`clubs/club-a/members/${ADMIN}`).delete());
  });

  it('lets an admin change only the role, never demote or delete the owner', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, ADMIN);

    await assertSucceeds(db.doc(`clubs/club-a/members/${COACH}`).update({ role: 'admin' }));
    // Only the role may change.
    await assertFails(db.doc(`clubs/club-a/members/${COACH}`).update({ addedBy: ADMIN }));
    await assertFails(db.doc(`clubs/club-a/members/${COACH}`).update({ role: 'owner' }));

    await assertFails(db.doc(`clubs/club-a/members/${ADMIN}`).update({ role: 'member' }));
    await assertFails(db.doc(`clubs/club-a/members/${ADMIN}`).delete());

    // A non-owner member can be removed.
    await assertSucceeds(db.doc(`clubs/club-a/members/${COACH}`).delete());
  });

  it('refuses member writes when the club is not active', async () => {
    const env = await getTestEnv();
    for (const status of ['suspended', 'pending'] as const) {
      await env.clearFirestore();
      await seedClub(env, { ...CLUB_A, status });
      const db = dbAs(env, ADMIN);
      await assertFails(db.doc('clubs/club-a/members/new@example.com').set(newMember()));
      await assertFails(db.doc(`clubs/club-a/members/${COACH}`).update({ role: 'admin' }));
      await assertFails(db.doc(`clubs/club-a/members/${COACH}`).delete());
    }
  });
});
