import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('teams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ email: 'super@example.com', role: 'superadmin' });
      await db.doc('users/coach-uid').set({ email: 'coach@example.com', role: 'member' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'member' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a super-admin create and delete a team', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
    const ref = db.collection('teams').doc('new-team');
    await assertSucceeds(ref.set({ name: 'U19', adminEmails: ['coach@example.com'], createdBy: 'super-uid' }));
    await assertSucceeds(ref.delete());
  });

  it('denies a non-super-admin creating or deleting a team', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('teams').doc('x').set({ name: 'X', adminEmails: ['coach@example.com'], createdBy: 'coach-uid' })
    );
    await assertFails(db.doc('teams/team-1').delete());
  });

  it('denies a role member from creating a team, even listing themselves as admin', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(
      db.collection('teams').add({ name: 'U17', adminEmails: ['parent@example.com'], createdBy: 'viewer-uid' })
    );
  });

  it('lets a team admin read the team, denies a non-admin', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('teams/team-1').get());

    const outsiderDb = env.authenticatedContext('other-uid', { email: 'other@example.com' }).firestore();
    await assertFails(outsiderDb.doc('teams/team-1').get());
  });

  it('lets a team admin edit team info but not adminEmails', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1').update({ name: 'U17 renamed' }));
    await assertFails(db.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'intruder@example.com'] }));
  });

  it('denies a non-admin from updating the team', async () => {
    const env = await getTestEnv();
    const outsiderDb = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(outsiderDb.doc('teams/team-1').update({ name: 'Hacked' }));
  });

  it('lets a super-admin read a team they do not administer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1').get());
  });

  it('lets a super-admin change adminEmails on any team', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('super-uid', { email: 'super@example.com' }).firestore();
    await assertSucceeds(
      db.doc('teams/team-1').update({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
    );
  });
});
