import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub, serverTimestamp } from './testEnv';

// users/{uid} is a bare sign-in record: { email, createdAt }. Roles live on
// club member docs, so there is no role here to escalate.
const PARENT = 'parent@example.com';
const UID = `uid-${PARENT}`;

describe('users rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('creates its own user doc with email and createdAt only', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, PARENT);
    await assertSucceeds(db.doc(`users/${UID}`).set({ email: PARENT, createdAt: serverTimestamp() }));
    await assertSucceeds(db.doc(`users/${UID}`).get());
  });

  it('stores the lowercased email for a mixed-case sign-in', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('uid-mixed', { email: 'Mixed@Example.com', email_verified: true }).firestore();
    await assertFails(db.doc('users/uid-mixed').set({ email: 'Mixed@Example.com', createdAt: serverTimestamp() }));
    await assertSucceeds(db.doc('users/uid-mixed').set({ email: 'mixed@example.com', createdAt: serverTimestamp() }));
  });

  it('refuses a role field', async () => {
    const env = await getTestEnv();
    // Even a club admin cannot carry a role onto the platform-wide user doc.
    await seedClub(env, { id: 'club-a', admins: [PARENT] });
    const db = dbAs(env, PARENT);
    for (const role of ['member', 'superadmin', 'admin']) {
      await assertFails(db.doc(`users/${UID}`).set({ email: PARENT, createdAt: serverTimestamp(), role }));
    }
  });

  it('refuses a missing field, another email or a client-chosen createdAt', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, PARENT);
    await assertFails(db.doc(`users/${UID}`).set({ email: PARENT }));
    await assertFails(db.doc(`users/${UID}`).set({ createdAt: serverTimestamp() }));
    await assertFails(db.doc(`users/${UID}`).set({ email: 'other@example.com', createdAt: serverTimestamp() }));
    await assertFails(db.doc(`users/${UID}`).set({ email: PARENT, createdAt: new Date('2020-01-01') }));
  });

  it('refuses another uid', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, PARENT);
    await assertFails(db.doc('users/other-uid').set({ email: PARENT, createdAt: serverTimestamp() }));
    await assertFails(env.unauthenticatedContext().firestore().doc(`users/${UID}`).set({ email: PARENT, createdAt: serverTimestamp() }));
  });

  it('refuses updates outside onboarding', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${UID}`).set({ email: PARENT, createdAt: new Date() });
    });
    const db = dbAs(env, PARENT);
    await assertFails(db.doc(`users/${UID}`).update({ role: 'superadmin' }));
    await assertFails(db.doc(`users/${UID}`).update({ email: PARENT, createdAt: serverTimestamp() }));
    await assertFails(db.doc(`users/${UID}`).delete());
  });

  async function seedUser() {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`users/${UID}`).set({ email: PARENT, createdAt: new Date() });
    });
    return env;
  }

  it('lets the owner set onboarding on a doc that has none', async () => {
    const env = await seedUser();
    const doc = dbAs(env, PARENT).doc(`users/${UID}`);
    await assertSucceeds(doc.update({ 'onboarding.welcomed': true }));
    await assertSucceeds(doc.update({ 'onboarding.tips': ['search'] }));
    await assertSucceeds(doc.update({ 'onboarding.hiddenChecklists': ['club-a'] }));
  });

  it('refuses onboarding writes from another user', async () => {
    const env = await seedUser();
    await assertFails(dbAs(env, 'other@example.com').doc(`users/${UID}`).update({ 'onboarding.welcomed': true }));
  });

  it('refuses changing email or createdAt alongside onboarding', async () => {
    const env = await seedUser();
    const doc = dbAs(env, PARENT).doc(`users/${UID}`);
    await assertFails(doc.update({ 'onboarding.welcomed': true, email: 'x@example.com' }));
    await assertFails(doc.update({ 'onboarding.welcomed': true, createdAt: serverTimestamp() }));
  });

  it('refuses unknown keys, wrong types and oversized lists', async () => {
    const env = await seedUser();
    const doc = dbAs(env, PARENT).doc(`users/${UID}`);
    await assertFails(doc.update({ 'onboarding.role': 'admin' }));
    await assertFails(doc.update({ 'onboarding.welcomed': 'yes' }));
    await assertFails(doc.update({ 'onboarding.tips': 'search' }));
    await assertFails(doc.update({ 'onboarding.tips': Array(33).fill('t') }));
    await assertFails(doc.update({ 'onboarding.tips': ['unknown-tip'] }));
    await assertFails(doc.update({ 'onboarding.tips': ['search', 5] }));
    await assertSucceeds(doc.update({ 'onboarding.tips': ['search', 'row-actions', 'scout-start', 'pdf-share', 'diagram'] }));
    await assertFails(doc.update({ 'onboarding.hiddenChecklists': Array(65).fill('c') }));
    await assertFails(doc.update({ onboarding: 'x' }));
  });

  it('gives an unverified email nothing', async () => {
    const env = await seedUser();
    const db = env.authenticatedContext(UID, { email: PARENT, email_verified: false }).firestore();
    await assertFails(db.doc(`users/${UID}`).update({ 'onboarding.welcomed': true }));
  });

  it("denies reading another user's doc", async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('users/other-uid').set({ email: 'other@example.com', createdAt: new Date() });
    });
    await assertFails(dbAs(env, PARENT).doc('users/other-uid').get());
  });
});
