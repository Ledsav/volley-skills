import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

async function seedTeam(env: Awaited<ReturnType<typeof getTestEnv>>, growthTestsEnabled = true) {
  await seedClub(env, {
    id: 'club-a',
    admins: ['super@example.com'],
    members: ['coach@example.com', 'other-coach@example.com', 'plain@example.com'],
    growthTestsEnabled,
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'], activeTestingSessionId: null });
    await db.doc('clubs/club-a/teams/team-2').set({ name: 'U15', adminEmails: ['other-coach@example.com'], activeTestingSessionId: null });
    await db.doc('clubs/club-a/teams/team-1/testingSessions/session-1').set({
      date: '2026-09-16',
      status: 'open',
      createdBy: 'coach-uid',
    });
    await db.doc('clubs/club-a/teams/team-1/testingSessions/session-closed').set({
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
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1/testingSessions/session-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'coach-uid' })
    );
    await assertSucceeds(db.doc('clubs/club-a/teams/team-1').update({ activeTestingSessionId: 'session-1' }));
  });

  it('denies a non-admin from reading or creating sessions', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'stranger@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/testingSessions/session-1').get());
    await assertFails(
      db.collection('clubs/club-a/teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'stranger-uid' })
    );
  });

  it('isolates sessions across teams', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'other-coach@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/testingSessions/session-1').get());
  });

  it('lets the team admin create and update an entry while the parent session is open', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(
      db.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: { cmjAttempts: [30] },
        resultTestId: null,
      })
    );
    await assertSucceeds(
      db.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').update({ status: 'complete' })
    );
  });

  it('denies writing an entry once the parent session is closed', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.doc('clubs/club-a/teams/team-1/testingSessions/session-closed/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });

  it('refuses a growth entry when the club has growth tests off', async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedTeam(env, false);
    const entries = 'clubs/club-a/teams/team-1/testingSessions/session-1/entries';
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`${entries}/player-2__growth`).set({
        playerId: 'player-2', testType: 'growth', status: 'in_progress', data: {}, resultTestId: null,
      });
    });
    const db = dbAs(env, 'coach@example.com');
    const entry = (testType: string) => ({
      playerId: 'player-1', testType, status: 'in_progress', data: {}, resultTestId: null,
    });
    await assertFails(db.doc(`${entries}/player-1__growth`).set(entry('growth')));
    await assertFails(db.doc(`${entries}/player-2__growth`).update({ status: 'complete' }));
    // Relabelling the stored growth entry does not get round the gate.
    await assertFails(db.doc(`${entries}/player-2__growth`).update({ testType: 'cmj', status: 'complete' }));
    // Other test types are unaffected, and an existing growth entry can still be deleted.
    await assertSucceeds(db.doc(`${entries}/player-1__cmj`).set(entry('cmj')));
    await assertSucceeds(db.doc(`${entries}/player-2__growth`).delete());
    // Control: with growth tests on, the same growth entry is accepted and the
    // relabel goes through.
    await env.clearFirestore();
    await seedTeam(env, true);
    await env.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(`${entries}/player-2__growth`).set({
        playerId: 'player-2', testType: 'growth', status: 'in_progress', data: {}, resultTestId: null,
      });
    });
    await assertSucceeds(db.doc(`${entries}/player-1__growth`).set(entry('growth')));
    await assertSucceeds(db.doc(`${entries}/player-2__growth`).update({ testType: 'cmj', status: 'complete' }));
  });

  it('denies a non-admin from reading or writing entries', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'stranger@example.com');
    await assertFails(db.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').get());
    await assertFails(
      db.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').set({
        playerId: 'player-1',
        testType: 'cmj',
        status: 'in_progress',
        data: {},
        resultTestId: null,
      })
    );
  });

  it('lets the team admin delete a session, denies anyone outside the team', async () => {
    const env = await getTestEnv();
    const stranger = dbAs(env, 'stranger@example.com');
    await assertFails(stranger.doc('clubs/club-a/teams/team-1/testingSessions/session-1').delete());

    const coach = dbAs(env, 'coach@example.com');
    await assertSucceeds(coach.doc('clubs/club-a/teams/team-1/testingSessions/session-1').delete());

    const clubAdmin = dbAs(env, 'super@example.com');
    await assertSucceeds(clubAdmin.doc('clubs/club-a/teams/team-1/testingSessions/session-1').delete());
  });

  it('lets the team admin delete entries, even in a closed session (player erasure)', async () => {
    const env = await getTestEnv();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-1/testingSessions/session-closed').set({ date: '2026-09-01', status: 'closed' });
      for (const path of [
        'clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj',
        'clubs/club-a/teams/team-1/testingSessions/session-closed/entries/player-1__cmj',
        'clubs/club-a/teams/team-1/testingSessions/session-closed/entries/player-2__cmj',
      ]) {
        await db.doc(path).set({ playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {} });
      }
    });

    const stranger = dbAs(env, 'stranger@example.com');
    await assertFails(stranger.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').delete());

    const coach = dbAs(env, 'coach@example.com');
    await assertSucceeds(coach.doc('clubs/club-a/teams/team-1/testingSessions/session-1/entries/player-1__cmj').delete());
    await assertSucceeds(coach.doc('clubs/club-a/teams/team-1/testingSessions/session-closed/entries/player-1__cmj').delete());

    const clubAdmin = dbAs(env, 'super@example.com');
    await assertSucceeds(clubAdmin.doc('clubs/club-a/teams/team-1/testingSessions/session-closed/entries/player-2__cmj').delete());
  });

  it('denies a club member who is not a team admin any session or entry access', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'plain@example.com');
    const s = 'clubs/club-a/teams/team-1/testingSessions/session-1';
    await assertFails(db.doc(s).get());
    await assertFails(db.collection('clubs/club-a/teams/team-1/testingSessions').add({ date: '2026-09-17', status: 'open', createdBy: 'uid-plain@example.com' }));
    await assertFails(db.doc(s).delete());
    await assertFails(db.doc(`${s}/entries/player-1__cmj`).get());
    await assertFails(
      db.doc(`${s}/entries/player-1__cmj`).set({ playerId: 'player-1', testType: 'cmj', status: 'in_progress', data: {}, resultTestId: null })
    );
    await assertFails(db.doc(`${s}/entries/player-1__cmj`).delete());
  });
});
