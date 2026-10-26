import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, OPERATOR, seedClub, seedPlatformAdmin } from './testEnv';

describe('interestSignups', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedPlatformAdmin(env, OPERATOR);
    await seedClub(env, { id: 'club-a', admins: ['club-admin@example.com'] });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('interestSignups/s-1').set({
        name: 'Jamie Coach', email: 'jamie@example.com', role: 'coach', reviewed: false, createdAt: new Date(),
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  function anonDb() {
    return getTestEnv().then((env) => env.unauthenticatedContext().firestore());
  }
  function authDb(uid: string, email: string) {
    return getTestEnv().then((env) => env.authenticatedContext(uid, { email, email_verified: true }).firestore());
  }

  it('lets a signed-out visitor create a valid signup', async () => {
    const db = await anonDb();
    await assertSucceeds(
      db.collection('interestSignups').add({
        name: 'Alex Guardian', email: 'alex@example.com', role: 'guardian', reviewed: false, createdAt: new Date(),
      }),
    );
  });

  it('lets a signed-in member (no access yet) create a valid signup too', async () => {
    const db = await authDb('member-uid', 'member@example.com');
    await assertSucceeds(
      db.collection('interestSignups').add({
        name: 'Sam Player', email: 'sam@example.com', role: 'player', reviewed: false, createdAt: new Date(),
      }),
    );
  });

  it('rejects a signup with an invalid role', async () => {
    const db = await anonDb();
    await assertFails(
      db.collection('interestSignups').add({
        name: 'Bad Role', email: 'bad@example.com', role: 'admin', reviewed: false, createdAt: new Date(),
      }),
    );
  });

  it('rejects a signup missing a name, or one already marked reviewed', async () => {
    const db = await anonDb();
    await assertFails(
      db.collection('interestSignups').add({
        name: '', email: 'blank@example.com', role: 'other', reviewed: false, createdAt: new Date(),
      }),
    );
    await assertFails(
      db.collection('interestSignups').add({
        name: 'Pre-reviewed', email: 'pre@example.com', role: 'other', reviewed: true, createdAt: new Date(),
      }),
    );
  });

  it('rejects a signup with extra fields', async () => {
    const db = await anonDb();
    await assertFails(
      db.collection('interestSignups').add({
        name: 'Extra', email: 'extra@example.com', role: 'other', reviewed: false, createdAt: new Date(), note: 'hi',
      }),
    );
  });

  it('denies a signed-in non-operator reading, updating, or deleting signups', async () => {
    const db = await authDb('member-uid', 'member@example.com');
    await assertFails(db.doc('interestSignups/s-1').get());
    await assertFails(db.doc('interestSignups/s-1').update({ reviewed: true }));
    await assertFails(db.doc('interestSignups/s-1').delete());
  });

  it('denies an anonymous visitor reading, updating, or deleting signups', async () => {
    const db = await anonDb();
    await assertFails(db.doc('interestSignups/s-1').get());
    await assertFails(db.doc('interestSignups/s-1').update({ reviewed: true }));
  });

  it('denies a club admin reading sign-ups', async () => {
    const db = dbAs(await getTestEnv(), 'club-admin@example.com');
    await assertFails(db.doc('interestSignups/s-1').get());
    await assertFails(db.collection('interestSignups').get());
    await assertFails(db.doc('interestSignups/s-1').update({ reviewed: true }));
    await assertFails(db.doc('interestSignups/s-1').delete());
  });

  it('lets the platform admin read, mark reviewed, and delete signups', async () => {
    const db = dbAs(await getTestEnv(), OPERATOR);
    await assertSucceeds(db.collection('interestSignups').get());
    await assertSucceeds(db.doc('interestSignups/s-1').get());
    await assertSucceeds(db.doc('interestSignups/s-1').update({ reviewed: true }));
    await assertSucceeds(db.doc('interestSignups/s-1').delete());
  });
});
