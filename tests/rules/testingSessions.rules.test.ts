import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

async function seedTeam(env: Awaited<ReturnType<typeof getTestEnv>>) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'], activeTestingSessionId: null });
    await db.doc('teams/team-2').set({ name: 'U15', adminEmails: ['other-coach@example.com'], activeTestingSessionId: null });
    await db.doc('teams/team-1/testingSessions/session-1').set({
      date: '2026-09-16',
      status: 'open',
      createdBy: 'coach-uid',
    });
    await db.doc('teams/team-1/testingSessions/session-closed').set({
      date: '2026-09-10',
      status: 'closed',
      createdBy: 'coach-uid',
    });
  });
}

describe('testingSessions rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeam(env);
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets the team admin read and create sessions, and update the team pointer', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('teams/team-1/testingSessions/session-1').get());
    await assertSucceeds(
      db.collection('teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'coach-uid' })
    );
    await assertSucceeds(db.doc('teams/team-1').update({ activeTestingSessionId: 'session-1' }));
  });

  it('denies a non-admin from reading or creating sessions', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1').get());
    await assertFails(
      db.collection('teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'stranger-uid' })
    );
  });

  it('isolates sessions across teams', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('other-coach-uid', { email: 'other-coach@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1').get());
  });

  it('lets the team admin create and update an entry while the parent session is open', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: { cmjAttempts: [30] },
        resultTestId: null,
      })
    );
    await assertSucceeds(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').update({ status: 'complete' })
    );
  });

  it('denies writing an entry once the parent session is closed', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('coach-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(
      db.doc('teams/team-1/testingSessions/session-closed/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });

  it('denies a non-admin from reading or writing entries', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('stranger-uid', { email: 'stranger@example.com' }).firestore();
    await assertFails(db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').get());
    await assertFails(
      db.doc('teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });
});
