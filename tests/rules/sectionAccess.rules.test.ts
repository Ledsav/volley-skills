import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('sectionAccess + section-gated libraries', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ email: 'super@example.com', role: 'superadmin' });
      await db.doc('users/ex-uid').set({ email: 'ex@example.com', role: 'member' });
      await db.doc('users/tr-uid').set({ email: 'tr@example.com', role: 'member' });
      await db.doc('users/none-uid').set({ email: 'none@example.com', role: 'member' });
      await db.doc('sectionAccess/exercises').set({ adminEmails: ['ex@example.com'] });
      await db.doc('sectionAccess/trainings').set({ adminEmails: ['tr@example.com'] });
      await db.doc('sectionAccess/guides').set({ adminEmails: [] });
      await db.doc('exercises/e-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'x' });
      await db.doc('trainings/t-1').set({
        name: 'Passing circuit', businessId: 'TR-0007', description: '',
        exercises: [], exerciseIds: [], createdBy: 'x',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  function ctx(uid: string, email: string) {
    return getTestEnv().then((env) => env.authenticatedContext(uid, { email }).firestore());
  }

  it('lets a super-admin read and write any section doc', async () => {
    const db = await ctx('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('sectionAccess/exercises').get());
    await assertSucceeds(db.doc('sectionAccess/guides').update({ adminEmails: ['x@example.com'] }));
  });

  it('lets a listed member read its own section doc but not write it', async () => {
    const db = await ctx('ex-uid', 'ex@example.com');
    await assertSucceeds(db.doc('sectionAccess/exercises').get());
    await assertFails(db.doc('sectionAccess/exercises').update({ adminEmails: [] }));
  });

  it('denies an unlisted member reading a section doc', async () => {
    const db = await ctx('none-uid', 'none@example.com');
    await assertFails(db.doc('sectionAccess/trainings').get());
  });

  it('rejects a non-list adminEmails on write', async () => {
    const db = await ctx('super-uid', 'super@example.com');
    await assertFails(db.doc('sectionAccess/guides').update({ adminEmails: 'nope' }));
    await assertSucceeds(db.doc('sectionAccess/guides').update({ adminEmails: [], extra: 1 }));
  });

  it('lets a super-admin update a section doc that already carries seed/migration metadata', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('sectionAccess/exercises').set({
        adminEmails: ['ex@example.com'],
        addedBy: 'seed-script',
        addedAt: new Date(),
        migratedAt: new Date(),
      })
    );
    const db = await ctx('super-uid', 'super@example.com');
    await assertSucceeds(
      db.doc('sectionAccess/exercises').set({ adminEmails: ['new@example.com'] }, { merge: true })
    );
  });

  it('grants exercises CRUD to an exercises-granted member', async () => {
    const db = await ctx('ex-uid', 'ex@example.com');
    await assertSucceeds(db.doc('exercises/e-1').get());
    await assertSucceeds(db.doc('exercises/e-1').update({ name: 'Pepper 2', category: 'warmup' }));
  });

  it('lets a trainings-granted member READ exercises but not write them', async () => {
    const db = await ctx('tr-uid', 'tr@example.com');
    await assertSucceeds(db.doc('exercises/e-1').get());
    await assertFails(db.doc('exercises/e-1').update({ name: 'nope', category: 'warmup' }));
  });

  it('denies a member with no library grant any exercise or training read', async () => {
    const db = await ctx('none-uid', 'none@example.com');
    await assertFails(db.doc('exercises/e-1').get());
    await assertFails(db.doc('trainings/t-1').get());
  });

  it('grants trainings CRUD + counters to a trainings-granted member', async () => {
    const db = await ctx('tr-uid', 'tr@example.com');
    await assertSucceeds(db.doc('trainings/t-1').get());
    await assertSucceeds(
      db.doc('trainings/t-1').update({
        name: 'Passing circuit v2', businessId: 'TR-0007',
        exercises: [], exerciseIds: [],
      })
    );
    await assertSucceeds(db.doc('counters/trainings').set({ lastSequence: 7 }));
  });

  it('lets a guides-granted member write the guide configs; any signed-in user reads them', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('sectionAccess/guides').set({ adminEmails: ['g@example.com'] })
    );
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('users/g-uid').set({ email: 'g@example.com', role: 'member' })
    );
    const gdb = await ctx('g-uid', 'g@example.com');
    await assertSucceeds(gdb.doc('skillGuide/config').set({ skills: {}, updatedBy: 'g-uid' }));
    await assertSucceeds(gdb.doc('physicalTestGuide/config').set({ tests: {}, updatedBy: 'g-uid' }));

    const ndb = await ctx('none-uid', 'none@example.com');
    await assertSucceeds(ndb.doc('skillGuide/config').get());
  });
});
