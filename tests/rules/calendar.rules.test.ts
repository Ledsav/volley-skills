import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

describe('calendar rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-1/players/player-1').set({
        fullName: 'Test Player',
        viewerEmails: ['parent@example.com'],
      });
      await db.doc('teams/team-1/calendar/session-1').set({
        date: '2026-09-10',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: '',
        createdBy: 'coach-uid',
      });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read, create, and delete calendar sessions', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/calendar/session-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'coach-uid',
      })
    );
    await assertSucceeds(db.doc('teams/team-1/calendar/session-1').delete());
  });

  it('denies updating a calendar session (v1 has no edit)', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/calendar/session-1').update({ notes: 'changed' }));
  });

  it('denies the linked viewer and unrelated users any access', async () => {
    const env = await getTestEnv();
    const viewerDb = env.authenticatedContext('parent-uid', { email: 'parent@example.com' }).firestore();
    await assertFails(viewerDb.doc('teams/team-1/calendar/session-1').get());
    await assertFails(viewerDb.doc('teams/team-1/calendar/session-1').delete());

    const strangerDb = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(strangerDb.doc('teams/team-1/calendar/session-1').get());
  });

  it('denies creating a session whose createdBy is not the caller', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.collection('teams/team-1/calendar').add({
        date: '2026-09-12',
        trainingId: 't-2',
        trainingBusinessId: 'TR-0008',
        trainingName: 'Serve & pass',
        notes: '',
        createdBy: 'someone-else',
      })
    );
  });
});
