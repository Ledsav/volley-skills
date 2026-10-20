import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('trainings and counters rules', () => {
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

  it('denies a viewer-role user creating or updating a training with an otherwise valid shape', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(
      db.collection('trainings').add({
        businessId: 'TR-0003',
        name: 'Serve & pass',
        description: '',
        ageGroupTarget: 'U15',
        exercises: [],
        exerciseIds: [],
        createdBy: 'viewer-uid',
      })
    );
    await assertFails(db.doc('trainings/training-1').update({ name: 'x' }));
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
  describe('optional suggestedPlayers and targets', () => {
    const base = {
      businessId: 'TR-0002',
      name: 'Serve receive',
      description: '',
      ageGroupTarget: '',
      exercises: [],
      exerciseIds: [],
      createdBy: 'admin-uid',
    };
    const adminDb = async () =>
      (await getTestEnv()).authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();

    it('allows creating with valid suggestedPlayers and targets', async () => {
      const db = await adminDb();
      await assertSucceeds(
        db.collection('trainings').add({ ...base, suggestedPlayers: 12, targets: ['service', 'reception'] }),
      );
      await assertSucceeds(db.collection('trainings').add({ ...base, suggestedPlayers: 60 }));
    });

    it('still allows a training with neither field', async () => {
      const db = await adminDb();
      await assertSucceeds(db.collection('trainings').add(base));
    });

    it('denies an out-of-range or non-integer suggestedPlayers', async () => {
      const db = await adminDb();
      for (const suggestedPlayers of [0, 61, 3.5, '12']) {
        await assertFails(db.collection('trainings').add({ ...base, suggestedPlayers }));
      }
    });

    it('denies targets that are not a 1-9 list of categories', async () => {
      const db = await adminDb();
      await assertFails(db.collection('trainings').add({ ...base, targets: 'service' }));
      await assertFails(db.collection('trainings').add({ ...base, targets: [] }));
      await assertFails(db.collection('trainings').add({ ...base, targets: ['nonsense'] }));
      await assertFails(db.collection('trainings').add({ ...base, targets: Array(10).fill('service') }));
    });

    it('allows setting, and later removing, the fields on update', async () => {
      const db = await adminDb();
      await assertSucceeds(db.doc('trainings/training-1').update({ suggestedPlayers: 8, targets: ['defense'] }));
      await assertSucceeds(db.doc('trainings/training-1').set({ ...base, businessId: 'TR-0001' }));
    });

    it('denies an invalid value on update', async () => {
      const db = await adminDb();
      await assertFails(db.doc('trainings/training-1').update({ suggestedPlayers: 0 }));
      await assertFails(db.doc('trainings/training-1').update({ targets: ['nonsense'] }));
    });
  });
});
