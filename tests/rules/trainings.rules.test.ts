import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('trainings and counters rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('trainings/training-1').set({
        businessId: 'TR-0001',
        name: 'Passing circuit',
        description: '',
        ageGroupTarget: 'U17',
        exercises: [],
        exerciseIds: [],
        createdBy: 'admin-uid',
      });
      await db.doc('counters/trainings').set({ lastSequence: 1 });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin read, create, update, and delete trainings', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('trainings/training-1').get());
    await assertSucceeds(
      db.collection('trainings').add({
        businessId: 'TR-0002',
        name: 'Serve & pass',
        description: '',
        ageGroupTarget: 'U15',
        exercises: [],
        exerciseIds: [],
        createdBy: 'admin-uid',
      })
    );
    await assertSucceeds(db.doc('trainings/training-1').update({ name: 'Passing circuit v2' }));
    await assertSucceeds(db.doc('trainings/training-1').delete());
  });

  it('denies changing a training business id on update', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('trainings/training-1').update({ businessId: 'TR-9999' }));
  });

  it('denies a non-admin (viewer role) any read or write on trainings', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('trainings/training-1').get());
    await assertFails(db.doc('trainings/training-1').delete());
  });

  it('lets a global admin read and write the counter, denies a non-admin', async () => {
    const env = await getTestEnv();
    const adminDb = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(adminDb.doc('counters/trainings').get());
    await assertSucceeds(adminDb.doc('counters/trainings').set({ lastSequence: 2 }));

    const viewerDb = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('counters/trainings').get());
    await assertFails(viewerDb.doc('counters/trainings').set({ lastSequence: 999 }));
  });

  it('denies a counter write whose lastSequence is not a non-negative integer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('counters/trainings').set({ lastSequence: -1 }));
    await assertFails(db.doc('counters/trainings').set({ lastSequence: 'lots' }));
  });
});
