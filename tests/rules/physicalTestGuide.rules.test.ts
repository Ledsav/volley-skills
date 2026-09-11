import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('physicalTestGuide rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/coach@example.com').set({});
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'superadmin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'member' });
      await db.doc('sectionAccess/exercises').set({ adminEmails: [] });
      await db.doc('sectionAccess/trainings').set({ adminEmails: [] });
      await db.doc('sectionAccess/guides').set({ adminEmails: [] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin write the physical test guide, denies a non-admin write', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('physicalTestGuide/config').set({ tests: [] }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('physicalTestGuide/config').set({ tests: [] }));
  });

  it('lets any signed-in user read the physical test guide', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(viewerDb.doc('physicalTestGuide/config').get());
  });
});
