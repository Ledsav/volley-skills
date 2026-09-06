import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('teams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/coach-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a user create a team that lists themselves as an admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      db.collection('teams').add({ name: 'U17', adminEmails: ['coach@example.com'], createdBy: 'coach-uid' })
    );
  });

  it('denies a role viewer from creating a team, even listing themselves as admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(
      db.collection('teams').add({ name: 'U17', adminEmails: ['parent@example.com'], createdBy: 'viewer-uid' })
    );
  });

  it('denies creating a team that does not include the creator in adminEmails', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('teams').add({ name: 'U17', adminEmails: ['someone-else@example.com'], createdBy: 'coach-uid' })
    );
  });

  it('lets a team admin read the team, denies a non-admin', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1').get());

    const outsiderDb = env.authenticatedContext('other-uid', { email: 'other@example.com' }).firestore();
    await assertFails(outsiderDb.doc('teams/team-1').get());
  });

  it('lets an existing admin add another admin by email', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      adminDb.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
    );
  });

  it('denies leaving a team with zero admins', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(adminDb.doc('teams/team-1').update({ adminEmails: [] }));
  });

  it('denies a non-admin from updating the team', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });

    const outsiderDb = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(outsiderDb.doc('teams/team-1').update({ name: 'Hacked' }));
  });

  it('lets an admin remove themselves when another admin remains', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context
        .firestore()
        .doc('teams/team-1')
        .set({ name: 'U17', adminEmails: ['coach@example.com', 'assistant@example.com'] });
    });

    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1').update({ adminEmails: ['assistant@example.com'] }));
  });
});
