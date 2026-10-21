import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

describe('calendar rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['super@example.com'],
      members: ['coach@example.com', 'parent@example.com', 'other-coach@example.com'],
      sections: { trainings: ['coach@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('clubs/club-a/teams/team-2').set({ name: 'U15', adminEmails: ['other-coach@example.com'] });
      await db.doc('clubs/club-a/teams/team-1/players/player-1').set({
        fullName: 'Test Player',
        viewerEmails: ['parent@example.com'],
      });
      await db.doc('clubs/club-a/teams/team-1/calendar/session-1').set({
        date: '2026-09-10',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: '',
        createdBy: 'uid-coach@example.com',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read, create, and delete calendar sessions', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'uid-coach@example.com',
      })
    );
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/calendar/session-1').delete());
  });

  it('denies updating a calendar session (v1 has no edit)', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/calendar/session-1').update({ notes: 'changed' }));
  });

  it('denies the linked viewer and unrelated users any access', async () => {
    const env = await getTestEnv();
    const viewerDb = dbAs(env, 'parent@example.com');
    await assertFails(viewerDb.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
    await assertFails(viewerDb.doc('clubs/club-a/teams/team-1/calendar/session-1').delete());

    const strangerDb = dbAs(env, 'stranger@example.com');
    await assertFails(strangerDb.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
  });

  it('denies a team admin who has no trainings access', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (c) =>
      c.firestore().doc('clubs/club-a/sectionAccess/trainings').set({ adminEmails: [] }) // revoke
    );
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
    await assertFails(
      db.collection('clubs/club-a/teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'x',
        notes: '',
        createdBy: 'uid-coach@example.com',
      })
    );
  });

  it('denies creating a session whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'someone-else',
      })
    );
  });

  it('isolates calendars across teams: another team admin gets nothing on team-1', async () => {
    const env = await getTestEnv();
    const otherDb = dbAs(env, 'other-coach@example.com');
    await assertFails(otherDb.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
    await assertFails(
      otherDb.collection('clubs/club-a/teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'other-coach-uid',
      })
    );
    await assertFails(otherDb.doc('clubs/club-a/teams/team-1/calendar/session-1').delete());
  });

  it('lets a club admin who is NOT in adminEmails read, create, and delete sessions', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'super@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/calendar/session-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'uid-super@example.com',
      })
    );
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/calendar/session-1').delete());
  });

  it('denies creating a session whose date is not a string', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/teams/team-1/calendar').add({
        date: 20260910,
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'uid-coach@example.com',
      })
    );
  });
});
