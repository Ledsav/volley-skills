import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('exercises rules', () => {
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
      await db.doc('exercises/ex-1').set({
        name: 'Pepper',
        description: '',
        category: 'warmup',
        createdBy: 'admin-uid',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a global admin read, create, update, and delete exercises', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('exercises/ex-1').get());
    await assertSucceeds(
      db.collection('exercises').add({
        name: 'Serve targets',
        description: '',
        category: 'service',
        createdBy: 'admin-uid',
      })
    );
    await assertSucceeds(db.doc('exercises/ex-1').update({ name: 'Pepper v2' }));
    await assertSucceeds(db.doc('exercises/ex-1').delete());
  });

  it('denies a non-admin (viewer role) any read or write', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(db.doc('exercises/ex-1').get());
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'viewer-uid' })
    );
    await assertFails(db.doc('exercises/ex-1').delete());
  });

  it('denies creating an exercise with an unknown category or empty name', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'nonsense', createdBy: 'admin-uid' })
    );
    await assertFails(
      db.collection('exercises').add({ name: '', description: '', category: 'warmup', createdBy: 'admin-uid' })
    );
  });

  it('denies an admin update that violates the category or name validation', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('exercises/ex-1').update({ category: 'nonsense' }));
    await assertFails(db.doc('exercises/ex-1').update({ name: '' }));
  });

  it('denies creating an exercise whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'someone-else' })
    );
  });
  describe('optional minPlayers', () => {
    const base = { name: 'Serve targets', description: '', category: 'service', createdBy: 'admin-uid' };
    const adminDb = async () =>
      (await getTestEnv()).authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();

    it('allows creating with a whole number from 1 to 30', async () => {
      const db = await adminDb();
      await assertSucceeds(db.collection('exercises').add({ ...base, minPlayers: 1 }));
      await assertSucceeds(db.collection('exercises').add({ ...base, minPlayers: 30 }));
    });

    it('denies creating with an out-of-range or non-integer minPlayers', async () => {
      const db = await adminDb();
      for (const minPlayers of [0, 31, 7.5, '6', null]) {
        await assertFails(db.collection('exercises').add({ ...base, minPlayers }));
      }
    });

    it('allows setting and later removing minPlayers on update', async () => {
      const db = await adminDb();
      await assertSucceeds(db.doc('exercises/ex-1').update({ minPlayers: 12 }));
      await assertSucceeds(
        db.doc('exercises/ex-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'admin-uid' }),
      );
    });

    it('denies updating to an invalid minPlayers', async () => {
      const db = await adminDb();
      await assertFails(db.doc('exercises/ex-1').update({ minPlayers: 0 }));
      await assertFails(db.doc('exercises/ex-1').update({ minPlayers: 2.5 }));
    });
  });
});
