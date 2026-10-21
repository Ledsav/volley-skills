import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('sectionAccess + section-gated libraries', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['super@example.com'],
      members: ['ex@example.com', 'tr@example.com', 'none@example.com'],
      sections: { exercises: ['ex@example.com'], trainings: ['tr@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/exercises/e-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'x' });
      await db.doc('clubs/club-a/trainings/t-1').set({
        name: 'Passing circuit', businessId: 'TR-0007', description: '',
        exercises: [], exerciseIds: [], createdBy: 'x',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  const as = async (email: string) => dbAs(await getTestEnv(), email);

  it('lets a club admin read and write any section doc', async () => {
    const db = await as('super@example.com');
    await assertSucceeds(db.doc('clubs/club-a/sectionAccess/exercises').get());
    await assertSucceeds(db.doc('clubs/club-a/sectionAccess/guides').update({ adminEmails: ['x@example.com'] }));
  });

  it('lets a listed member read its own section doc but not write it', async () => {
    const db = await as('ex@example.com');
    await assertSucceeds(db.doc('clubs/club-a/sectionAccess/exercises').get());
    await assertFails(db.doc('clubs/club-a/sectionAccess/exercises').update({ adminEmails: [] }));
  });

  it('denies an unlisted member reading a section doc, and writing one', async () => {
    const db = await as('none@example.com');
    await assertFails(db.doc('clubs/club-a/sectionAccess/trainings').get());
    await assertFails(db.doc('clubs/club-a/sectionAccess/trainings').update({ adminEmails: ['none@example.com'] }));
  });

  it('denies a non-member reading or writing a section doc', async () => {
    const db = await as('outsider@example.com');
    await assertFails(db.doc('clubs/club-a/sectionAccess/trainings').get());
    await assertFails(db.doc('clubs/club-a/sectionAccess/trainings').update({ adminEmails: ['outsider@example.com'] }));
  });

  it('rejects a non-list adminEmails on write', async () => {
    const db = await as('super@example.com');
    await assertFails(db.doc('clubs/club-a/sectionAccess/guides').update({ adminEmails: 'nope' }));
    await assertSucceeds(db.doc('clubs/club-a/sectionAccess/guides').update({ adminEmails: [] }));
  });

  it('refuses a sectionAccess write with extra keys', async () => {
    const db = await as('super@example.com');
    await assertFails(db.doc('clubs/club-a/sectionAccess/guides').set({ adminEmails: [], note: 'x' }));
    await assertFails(db.doc('clubs/club-a/sectionAccess/guides').update({ note: 'x' }));
  });

  it('grants exercises CRUD to an exercises-granted member', async () => {
    const db = await as('ex@example.com');
    await assertSucceeds(db.doc('clubs/club-a/exercises/e-1').get());
    await assertSucceeds(db.doc('clubs/club-a/exercises/e-1').update({ name: 'Pepper 2', category: 'warmup' }));
  });

  it('lets a trainings-granted member READ exercises but not write them', async () => {
    const db = await as('tr@example.com');
    await assertSucceeds(db.doc('clubs/club-a/exercises/e-1').get());
    await assertFails(db.doc('clubs/club-a/exercises/e-1').update({ name: 'nope', category: 'warmup' }));
  });

  it('denies a member with no library grant any exercise or training read', async () => {
    const db = await as('none@example.com');
    await assertFails(db.doc('clubs/club-a/exercises/e-1').get());
    await assertFails(db.doc('clubs/club-a/trainings/t-1').get());
  });

  it('grants trainings CRUD + counters to a trainings-granted member', async () => {
    const db = await as('tr@example.com');
    await assertSucceeds(db.doc('clubs/club-a/trainings/t-1').get());
    await assertSucceeds(
      db.doc('clubs/club-a/trainings/t-1').update({
        name: 'Passing circuit v2', businessId: 'TR-0007',
        exercises: [], exerciseIds: [],
      })
    );
    await assertSucceeds(db.doc('clubs/club-a/counters/trainings').set({ lastSequence: 7 }));
  });

  it('lets a guides-granted member write the guide configs; any active member reads them', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('clubs/club-a/sectionAccess/guides').set({ adminEmails: ['ex@example.com'] })
    );
    const gdb = await as('ex@example.com');
    await assertSucceeds(gdb.doc('clubs/club-a/config/skillGuide').set({ skills: {}, updatedBy: 'uid-ex@example.com' }));
    await assertSucceeds(gdb.doc('clubs/club-a/config/physicalTestGuide').set({ tests: {}, updatedBy: 'uid-ex@example.com' }));

    const ndb = await as('none@example.com');
    await assertSucceeds(ndb.doc('clubs/club-a/config/skillGuide').get());
    await assertFails(ndb.doc('clubs/club-a/config/skillGuide').set({ skills: {} }));
  });
});
