import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('skillGuide rules', () => {
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

  it('lets a global admin write the skill guide, denies a non-admin write', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('skillGuide/config').set({ skills: [] }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('skillGuide/config').set({ skills: [] }));
  });

  it('denies a team admin whose global role is viewer from writing the skill guide', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      // parent@example.com is in a team's adminEmails (team-scoped admin) but
      // their users/{uid}.role is still 'viewer' (global role). The two
      // "admin" concepts must not be conflated.
      await context
        .firestore()
        .doc('teams/team-1')
        .set({ name: 'U17', adminEmails: ['parent@example.com'] });
    });

    const teamAdminDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(teamAdminDb.doc('skillGuide/config').set({ skills: [] }));
  });

  it('lets any signed-in user read the skill guide', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertSucceeds(viewerDb.doc('skillGuide/config').get());
  });
});
