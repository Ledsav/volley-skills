import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('exercises rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'exer@example.com', 'trainer@example.com'],
      sections: { exercises: ['exer@example.com'], trainings: ['trainer@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clubs/club-a/exercises/ex-1').set({
        name: 'Pepper',
        description: '',
        category: 'warmup',
        createdBy: 'seed',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a club admin read, create, update, and delete exercises', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/exercises').add({
        name: 'Serve targets',
        description: '',
        category: 'service',
        createdBy: 'uid-coach@example.com',
      })
    );
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1').update({ name: 'Pepper v2' }));
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1').delete());
  });

  it('denies a club member without the exercises section any read or write', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertFails(db.doc('clubs/club-a/exercises/ex-1').get());
    await assertFails(
      db.collection('clubs/club-a/exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'uid-parent@example.com' })
    );
    await assertFails(db.doc('clubs/club-a/exercises/ex-1').update({ name: 'Y' }));
    await assertFails(db.doc('clubs/club-a/exercises/ex-1').delete());
  });

  it('lets an exercises-section member write, and a trainings-only member read but not write', async () => {
    const env = await getTestEnv();
    const exer = dbAs(env, 'exer@example.com');
    await assertSucceeds(exer.doc('clubs/club-a/exercises/ex-1').update({ name: 'Pepper 2' }));
    await assertSucceeds(exer.doc('clubs/club-a/exercises/ex-1').delete());
    const trainer = dbAs(env, 'trainer@example.com');
    await assertSucceeds(trainer.doc('clubs/club-a/exercises/ex-1').get());
    await assertFails(trainer.doc('clubs/club-a/exercises/ex-1').update({ name: 'Nope' }));
    await assertFails(trainer.doc('clubs/club-a/exercises/ex-1').delete());
  });

  it('denies a non-member and an unauthenticated caller', async () => {
    const env = await getTestEnv();
    const outsider = dbAs(env, 'outsider@example.com');
    await assertFails(outsider.doc('clubs/club-a/exercises/ex-1').get());
    await assertFails(
      outsider.collection('clubs/club-a/exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'uid-outsider@example.com' })
    );
    await assertFails(env.unauthenticatedContext().firestore().doc('clubs/club-a/exercises/ex-1').get());
  });

  it('denies the library once the club is suspended, except export-only reads for a club admin', async () => {
    const env = await getTestEnv();
    await seedClub(env, {
      id: 'club-s', status: 'suspended', admins: ['coach@example.com'], members: ['exer@example.com'],
      sections: { exercises: ['exer@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('clubs/club-s/exercises/ex-1').set({ name: 'P', description: '', category: 'warmup', createdBy: 'seed' })
    );
    await assertSucceeds(dbAs(env, 'coach@example.com').doc('clubs/club-s/exercises/ex-1').get());
    await assertFails(dbAs(env, 'coach@example.com').doc('clubs/club-s/exercises/ex-1').update({ name: 'Q' }));
    await assertFails(dbAs(env, 'exer@example.com').doc('clubs/club-s/exercises/ex-1').get());
  });

  it('denies creating an exercise with an unknown category or empty name', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/exercises').add({ name: 'X', description: '', category: 'nonsense', createdBy: 'uid-coach@example.com' })
    );
    await assertFails(
      db.collection('clubs/club-a/exercises').add({ name: '', description: '', category: 'warmup', createdBy: 'uid-coach@example.com' })
    );
  });

  it('denies an admin update that violates the category or name validation', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc('clubs/club-a/exercises/ex-1').update({ category: 'nonsense' }));
    await assertFails(db.doc('clubs/club-a/exercises/ex-1').update({ name: '' }));
  });

  it('denies creating an exercise whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/exercises').add({ name: 'X', description: '', category: 'warmup', createdBy: 'someone-else' })
    );
  });
  describe('optional minPlayers', () => {
    const base = { name: 'Serve targets', description: '', category: 'service', createdBy: 'uid-coach@example.com' };
    const adminDb = async () =>
      dbAs(await getTestEnv(), 'coach@example.com');

    it('allows creating with a whole number from 1 to 30', async () => {
      const db = await adminDb();
      await assertSucceeds(db.collection('clubs/club-a/exercises').add({ ...base, minPlayers: 1 }));
      await assertSucceeds(db.collection('clubs/club-a/exercises').add({ ...base, minPlayers: 30 }));
    });

    it('denies creating with an out-of-range or non-integer minPlayers', async () => {
      const db = await adminDb();
      for (const minPlayers of [0, 31, 7.5, '6', null]) {
        await assertFails(db.collection('clubs/club-a/exercises').add({ ...base, minPlayers }));
      }
    });

    it('allows setting and later removing minPlayers on update', async () => {
      const db = await adminDb();
      await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1').update({ minPlayers: 12 }));
      await assertSucceeds(
        db.doc('clubs/club-a/exercises/ex-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'uid-coach@example.com' }),
      );
    });

    it('denies updating to an invalid minPlayers', async () => {
      const db = await adminDb();
      await assertFails(db.doc('clubs/club-a/exercises/ex-1').update({ minPlayers: 0 }));
      await assertFails(db.doc('clubs/club-a/exercises/ex-1').update({ minPlayers: 2.5 }));
    });
  });
});
