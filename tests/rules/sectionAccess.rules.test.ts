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
    await assertSucceeds(gdb.doc('clubs/club-a/config/skillGuide').set({ skills: [], updatedBy: 'uid-ex@example.com' }));
    await assertSucceeds(gdb.doc('clubs/club-a/config/physicalTestGuide').set({ tests: [], updatedBy: 'uid-ex@example.com' }));

    const ndb = await as('none@example.com');
    await assertSucceeds(ndb.doc('clubs/club-a/config/skillGuide').get());
    await assertFails(ndb.doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
  });

  it('suspended club: library, counter and section writes fail, admin export reads still work', async () => {
    const env = await getTestEnv();
    await seedClub(env, {
      id: 'club-s', status: 'suspended', admins: ['super@example.com'], members: ['tr@example.com'],
      sections: { trainings: ['tr@example.com'], exercises: ['tr@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await db.doc('clubs/club-s/exercises/e-1').set({ name: 'P', description: '', category: 'warmup', createdBy: 'x' });
      await db.doc('clubs/club-s/exercises/e-1/diagrams/d-1').set({
        title: 'D', order: 0, updatedBy: 'x', scene: { v: 1, court: 'full', items: [] },
      });
      await db.doc('clubs/club-s/trainings/t-1').set({
        name: 'T', businessId: 'TR-0001', description: '', exercises: [], exerciseIds: [], createdBy: 'x',
      });
      await db.doc('clubs/club-s/counters/trainings').set({ lastSequence: 1 });
    });
    const admin = await as('super@example.com');
    await assertSucceeds(admin.doc('clubs/club-s/trainings/t-1').get());
    await assertSucceeds(admin.doc('clubs/club-s/counters/trainings').get());
    await assertSucceeds(admin.doc('clubs/club-s/exercises/e-1/diagrams/d-1').get());
    await assertSucceeds(admin.doc('clubs/club-s/sectionAccess/trainings').get());
    await assertFails(admin.doc('clubs/club-s/trainings/t-1').update({ name: 'T2' }));
    await assertFails(admin.doc('clubs/club-s/counters/trainings').set({ lastSequence: 2 }));
    await assertFails(
      admin.collection('clubs/club-s/exercises/e-1/diagrams').add({
        title: 'N', order: 1, updatedBy: 'uid-super@example.com', scene: { v: 1, court: 'full', items: [] },
      })
    );
    await assertFails(admin.doc('clubs/club-s/sectionAccess/trainings').update({ adminEmails: [] }));
    const tr = await as('tr@example.com');
    await assertFails(tr.doc('clubs/club-s/trainings/t-1').get());
    await assertFails(tr.doc('clubs/club-s/trainings/t-1').update({ name: 'T3' }));
    await assertFails(tr.doc('clubs/club-s/counters/trainings').set({ lastSequence: 3 }));
    await assertFails(tr.doc('clubs/club-s/exercises/e-1/diagrams/d-1').get());
    await assertFails(tr.doc('clubs/club-s/sectionAccess/trainings').get());
  });

  it('denies an email still listed in every section but without a member doc', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      for (const sec of ['exercises', 'trainings', 'guides']) {
        await db.doc(`clubs/club-a/sectionAccess/${sec}`).set({ adminEmails: ['gone@example.com'] });
      }
      await db.doc('clubs/club-a/exercises/e-1/diagrams/d-1').set({
        title: 'D', order: 0, updatedBy: 'x', scene: { v: 1, court: 'full', items: [] },
      });
    });
    const gone = await as('gone@example.com');
    await assertFails(gone.doc('clubs/club-a/exercises/e-1').get());
    await assertFails(gone.doc('clubs/club-a/trainings/t-1').get());
    await assertFails(gone.doc('clubs/club-a/exercises/e-1/diagrams/d-1').get());
    await assertFails(gone.doc('clubs/club-a/sectionAccess/trainings').get());
    await assertFails(gone.doc('clubs/club-a/counters/trainings').set({ lastSequence: 9 }));
    await assertFails(gone.doc('clubs/club-a/config/skillGuide').set({ skills: [] }));
  });

  it('with no sectionAccess docs: a club admin still has full library access, a plain member is denied', async () => {
    const env = await getTestEnv();
    await seedClub(env, { id: 'club-n', admins: ['super@example.com'], members: ['plain@example.com'], skipSections: true });
    await env.withSecurityRulesDisabled(async (c) => {
      const db = c.firestore();
      await db.doc('clubs/club-n/exercises/e-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'x' });
      await db.doc('clubs/club-n/trainings/t-1').set({
        name: 'T', businessId: 'TR-0001', description: '', exercises: [], exerciseIds: [], createdBy: 'x',
      });
    });
    const admin = await as('super@example.com');
    await assertSucceeds(admin.doc('clubs/club-n/exercises/e-1').get());
    await assertSucceeds(admin.doc('clubs/club-n/exercises/e-1').update({ name: 'Pepper 2', category: 'warmup' }));
    await assertSucceeds(admin.doc('clubs/club-n/trainings/t-1').get());
    await assertSucceeds(
      admin.doc('clubs/club-n/trainings/t-1').update({ name: 'T2', businessId: 'TR-0001', exercises: [], exerciseIds: [] })
    );
    const plain = await as('plain@example.com');
    await assertFails(plain.doc('clubs/club-n/exercises/e-1').get());
    await assertFails(plain.doc('clubs/club-n/exercises/e-1').update({ name: 'nope', category: 'warmup' }));
    await assertFails(plain.doc('clubs/club-n/trainings/t-1').get());
    await assertFails(plain.doc('clubs/club-n/trainings/t-1').update({ name: 'nope' }));
  });
});
