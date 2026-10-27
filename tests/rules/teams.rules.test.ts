import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('teams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, { id: 'club-a', admins: ['super@example.com'], members: ['coach@example.com', 'parent@example.com', 'plain@example.com'] });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets a club admin create and delete a team', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'super@example.com');
    const ref = db.collection('clubs/club-a/teams').doc('new-team');
    await assertSucceeds(ref.set({ name: 'U19', adminEmails: ['coach@example.com'], createdBy: 'uid-super@example.com', gender: 'women' }));
    await assertSucceeds(ref.delete());
  });

  it('denies a non-club admin creating or deleting a team', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/teams').doc('x').set({ name: 'X', adminEmails: ['coach@example.com'], createdBy: 'uid-coach@example.com', gender: 'women' })
    );
    await assertFails(db.doc('clubs/club-a/teams/team-1').delete());
  });

  it('denies a role member from creating a team, even listing themselves as admin', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertFails(
      db.collection('clubs/club-a/teams').add({ name: 'U17', adminEmails: ['parent@example.com'], createdBy: 'uid-parent@example.com', gender: 'women' })
    );
  });

  it('lets a team admin read the team, denies a non-admin', async () => {
    const env = await getTestEnv();
    const adminDb = dbAs(env, 'coach@example.com');
    await assertSucceeds(adminDb.doc('clubs/club-a/teams/team-1').get());

    const outsiderDb = dbAs(env, 'other@example.com');
    await assertFails(outsiderDb.doc('clubs/club-a/teams/team-1').get());
  });

  it('lets a team admin edit team info but not adminEmails', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1').update({ name: 'U17 renamed' }));
    await assertFails(db.doc('clubs/club-a/teams/team-1').update({ adminEmails: ['coach@example.com', 'intruder@example.com'] }));
  });

  it('denies a non-admin from updating the team', async () => {
    const env = await getTestEnv();
    const outsiderDb = dbAs(env, 'stranger@example.com');
    await assertFails(outsiderDb.doc('clubs/club-a/teams/team-1').update({ name: 'Hacked' }));
  });

  it('denies a team admin who is not a member of the club', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('clubs/club-a/teams/team-1').update({ adminEmails: ['coach@example.com', 'ghost@example.com'] });
    });
    const db = dbAs(env, 'ghost@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1').get());
    await assertFails(db.doc('clubs/club-a/teams/team-1').update({ name: 'Hijack' }));
  });

  it('lets a club admin read a team they do not administer', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'super@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1').get());
  });

  it('lets a club admin change adminEmails on any team', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'super@example.com');
    await assertSucceeds(
      db.doc('clubs/club-a/teams/team-1').update({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
    );
  });

  it('denies a club member who is not a team admin from reading or renaming the team', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'plain@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1').get());
    await assertFails(db.doc('clubs/club-a/teams/team-1').update({ name: 'Hijack' }));
  });

  describe('gender', () => {
    const NEW = { name: 'U19', adminEmails: ['coach@example.com'], createdBy: 'uid-super@example.com' };

    it('refuses a team created without gender or with an unknown value', async () => {
      const env = await getTestEnv();
      const db = dbAs(env, 'super@example.com');
      await assertFails(db.doc('clubs/club-a/teams/t-none').set(NEW));
      await assertFails(db.doc('clubs/club-a/teams/t-bad').set({ ...NEW, gender: 'female' }));
    });

    it('accepts women, men and mixed on create', async () => {
      const env = await getTestEnv();
      const db = dbAs(env, 'super@example.com');
      for (const gender of ['women', 'men', 'mixed']) {
        await assertSucceeds(db.doc(`clubs/club-a/teams/t-${gender}`).set({ ...NEW, gender }));
      }
    });

    it('still lets an old team without gender change other fields (no migration)', async () => {
      const env = await getTestEnv();
      await assertSucceeds(dbAs(env, 'coach@example.com').doc('clubs/club-a/teams/team-1').update({ name: 'Renamed' }));
      await assertSucceeds(dbAs(env, 'super@example.com').doc('clubs/club-a/teams/team-1').update({ description: 'x' }));
    });

    it('validates gender on update', async () => {
      const env = await getTestEnv();
      const ref = dbAs(env, 'coach@example.com').doc('clubs/club-a/teams/team-1');
      await assertSucceeds(ref.update({ gender: 'men' }));
      await assertFails(ref.update({ gender: 'female' }));
      await assertFails(ref.update({ gender: null }));
    });
  });
});
