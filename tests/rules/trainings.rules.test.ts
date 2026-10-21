import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('trainings and counters rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'trainer@example.com', 'exer@example.com'],
      sections: { trainings: ['trainer@example.com'], exercises: ['exer@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/trainings/training-1').set({
        businessId: 'TR-0001',
        name: 'Passing circuit',
        description: '',
        ageGroupTarget: 'U17',
        exercises: [],
        exerciseIds: [],
        createdBy: 'seed',
      });
      await db.doc('clubs/club-a/counters/trainings').set({ lastSequence: 1 });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a club admin read, create, update, and delete trainings', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/trainings/training-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/trainings').add({
        businessId: 'TR-0002',
        name: 'Serve & pass',
        description: '',
        ageGroupTarget: 'U15',
        exercises: [],
        exerciseIds: [],
        createdBy: 'uid-coach@example.com',
      })
    );
    await assertSucceeds(db.doc('clubs/club-a/trainings/training-1').update({ name: 'Passing circuit v2' }));
    await assertSucceeds(db.doc('clubs/club-a/trainings/training-1').delete());
  });

  it('lets a trainings-section member write trainings and the counter, but an exercises-only member nothing', async () => {
    const env = await getTestEnv();
    const trainer = dbAs(env, 'trainer@example.com');
    await assertSucceeds(trainer.doc('clubs/club-a/trainings/training-1').update({ name: 'v2' }));
    await assertSucceeds(trainer.doc('clubs/club-a/counters/trainings').set({ lastSequence: 2 }));
    const exer = dbAs(env, 'exer@example.com');
    await assertFails(exer.doc('clubs/club-a/trainings/training-1').get());
    await assertFails(exer.doc('clubs/club-a/trainings/training-1').update({ name: 'nope' }));
    await assertFails(exer.doc('clubs/club-a/counters/trainings').get());
  });

  it('denies a non-member and an unauthenticated caller', async () => {
    const env = await getTestEnv();
    const outsider = dbAs(env, 'outsider@example.com');
    await assertFails(outsider.doc('clubs/club-a/trainings/training-1').get());
    await assertFails(outsider.doc('clubs/club-a/counters/trainings').set({ lastSequence: 5 }));
    await assertFails(env.unauthenticatedContext().firestore().doc('clubs/club-a/trainings/training-1').get());
  });

  it('denies changing a training business id on update', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc('clubs/club-a/trainings/training-1').update({ businessId: 'TR-9999' }));
  });

  it('denies a club member without the trainings section any read or write on trainings', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertFails(db.doc('clubs/club-a/trainings/training-1').get());
    await assertFails(db.doc('clubs/club-a/trainings/training-1').delete());
  });

  it('denies a club member without the trainings section creating or updating a training with an otherwise valid shape', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertFails(
      db.collection('clubs/club-a/trainings').add({
        businessId: 'TR-0003',
        name: 'Serve & pass',
        description: '',
        ageGroupTarget: 'U15',
        exercises: [],
        exerciseIds: [],
        createdBy: 'uid-parent@example.com',
      })
    );
    await assertFails(db.doc('clubs/club-a/trainings/training-1').update({ name: 'x' }));
  });

  it('lets a club admin read and write the counter, denies a member without the trainings section', async () => {
    const env = await getTestEnv();
    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/counters/trainings').get());
    await assertSucceeds(adminDb.doc('clubs/club-a/counters/trainings').set({ lastSequence: 2 }));

    const viewerDb = dbAs(env, 'parent@example.com');
    await assertFails(viewerDb.doc('clubs/club-a/counters/trainings').get());
    await assertFails(viewerDb.doc('clubs/club-a/counters/trainings').set({ lastSequence: 999 }));
  });

  it('denies a counter write whose lastSequence is not a non-negative integer', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc('clubs/club-a/counters/trainings').set({ lastSequence: -1 }));
    await assertFails(db.doc('clubs/club-a/counters/trainings').set({ lastSequence: 'lots' }));
  });
  describe('optional suggestedPlayers and targets', () => {
    const base = {
      businessId: 'TR-0002',
      name: 'Serve receive',
      description: '',
      ageGroupTarget: '',
      exercises: [],
      exerciseIds: [],
      createdBy: 'uid-coach@example.com',
    };
    const adminDb = async () =>
      dbAs(await getTestEnv(), 'coach@example.com');

    it('allows creating with valid suggestedPlayers and targets', async () => {
      const db = await adminDb();
      await assertSucceeds(
        db.collection('clubs/club-a/trainings').add({ ...base, suggestedPlayers: 12, targets: ['service', 'reception'] }),
      );
      await assertSucceeds(db.collection('clubs/club-a/trainings').add({ ...base, suggestedPlayers: 60 }));
    });

    it('still allows a training with neither field', async () => {
      const db = await adminDb();
      await assertSucceeds(db.collection('clubs/club-a/trainings').add(base));
    });

    it('denies an out-of-range or non-integer suggestedPlayers', async () => {
      const db = await adminDb();
      for (const suggestedPlayers of [0, 61, 3.5, '12']) {
        await assertFails(db.collection('clubs/club-a/trainings').add({ ...base, suggestedPlayers }));
      }
    });

    it('denies targets that are not a 1-9 list of categories', async () => {
      const db = await adminDb();
      await assertFails(db.collection('clubs/club-a/trainings').add({ ...base, targets: 'service' }));
      await assertFails(db.collection('clubs/club-a/trainings').add({ ...base, targets: [] }));
      await assertFails(db.collection('clubs/club-a/trainings').add({ ...base, targets: ['nonsense'] }));
      await assertFails(db.collection('clubs/club-a/trainings').add({ ...base, targets: Array(10).fill('service') }));
    });

    it('allows setting, and later removing, the fields on update', async () => {
      const db = await adminDb();
      await assertSucceeds(db.doc('clubs/club-a/trainings/training-1').update({ suggestedPlayers: 8, targets: ['defense'] }));
      await assertSucceeds(db.doc('clubs/club-a/trainings/training-1').set({ ...base, businessId: 'TR-0001' }));
    });

    it('denies an invalid value on update', async () => {
      const db = await adminDb();
      await assertFails(db.doc('clubs/club-a/trainings/training-1').update({ suggestedPlayers: 0 }));
      await assertFails(db.doc('clubs/club-a/trainings/training-1').update({ targets: ['nonsense'] }));
    });
  });
});
