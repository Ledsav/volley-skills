import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('users and adminAllowlist rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('denies all reads and writes on adminAllowlist even when authenticated', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('adminAllowlist/coach@example.com').get());
    await assertFails(db.doc('adminAllowlist/coach@example.com').set({}));
  });

  it('allows an allowlisted email to create their own user doc with role admin', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('adminAllowlist/coach@example.com').set({});
    });
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('users/coach-uid').set({ email: 'coach@example.com', role: 'admin' }));
  });

  it('denies a non-allowlisted email from creating a user doc with role admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('users/parent-uid').set({ email: 'parent@example.com', role: 'admin' }));
  });

  it('allows any authenticated user to create their own user doc with role viewer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(db.doc('users/parent-uid').set({ email: 'parent@example.com', role: 'viewer' }));
  });

  it('denies a user from updating or deleting their own user doc', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('users/parent-uid')
        .set({ email: 'parent@example.com', role: 'viewer' });
    });

    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    // This is the line that stops a viewer from self-promoting to admin.
    await assertFails(db.doc('users/parent-uid').update({ role: 'admin' }));
    await assertFails(db.doc('users/parent-uid').delete());
  });

  it("denies a user from reading another user's doc", async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('users/other-uid').set({ email: 'other@example.com', role: 'viewer' });
    });
    const db = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('users/other-uid').get());
  });
});
