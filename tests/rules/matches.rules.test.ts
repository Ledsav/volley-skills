import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const MATCH = {
  date: '2026-10-18',
  opponent: 'Rivals',
  status: 'setup',
  createdBy: 'coach-uid',
};
const ACTION = { type: 'action', order: 1, source: 'tap', chunkId: null, playerId: 'p1', skill: 'A', grade: '#' };

describe('matches rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ role: 'superadmin', email: 'super@example.com' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-2').set({ name: 'U15', adminEmails: ['other@example.com'] });
      await db.doc('teams/team-1/players/p1').set({ fullName: 'P', viewerEmails: ['parent@example.com'] });
      await db.doc('teams/team-1/matches/m1').set(MATCH);
      await db.doc('teams/team-1/matches/m1/events/e1').set(ACTION);
      await db.doc('teams/team-1/scoutProfile/usage').set({ players: {} });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  const as = async (uid: string, email: string) =>
    (await getTestEnv()).authenticatedContext(uid, { email }).firestore();

  it('lets the team admin read and write matches, events and usage', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertSucceeds(db.doc('teams/team-1/matches/m1').get());
    await assertSucceeds(db.collection('teams/team-1/matches').add(MATCH));
    await assertSucceeds(db.doc('teams/team-1/matches/m1').update({ status: 'live' }));
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').orderBy('order').limit(10).get());
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').add({ ...ACTION, order: 2 }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').update({ grade: '=' }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').delete());
    await assertSucceeds(db.doc('teams/team-1/scoutProfile/usage').set({ players: { p1: { matches: 1, totals: {} } } }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1').delete());
  });

  it('lets a superadmin read matches of any team', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('teams/team-1/matches/m1').get());
  });

  it('lets a superadmin read and write events and the scout profile of any team', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').orderBy('order').limit(10).get());
    await assertSucceeds(db.collection('teams/team-1/matches/m1/events').add({ ...ACTION, order: 2 }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').update({ grade: '-' }));
    await assertSucceeds(db.doc('teams/team-1/matches/m1/events/e1').delete());
    await assertSucceeds(db.doc('teams/team-1/scoutProfile/usage').get());
    await assertSucceeds(db.doc('teams/team-1/scoutProfile/usage').set({ players: { p1: { matches: 2, totals: {} } } }));
  });

  it('denies another team admin, a guardian viewer and strangers', async () => {
    for (const [uid, email] of [
      ['other-uid', 'other@example.com'],
      ['parent-uid', 'parent@example.com'],
      ['x-uid', 'x@example.com'],
    ]) {
      const db = await as(uid, email);
      await assertFails(db.doc('teams/team-1/matches/m1').get());
      await assertFails(db.doc('teams/team-1/matches/m1/events/e1').get());
      await assertFails(db.collection('teams/team-1/matches/m1/events').add(ACTION));
      await assertFails(db.doc('teams/team-1/scoutProfile/usage').get());
      await assertFails(db.doc('teams/team-1/scoutProfile/usage').set({ players: {} }));
      await assertFails(db.doc('teams/team-1/matches/m1').update({ status: 'live' }));
      await assertFails(db.doc('teams/team-1/matches/m1/events/e1').update({ grade: '=' }));
    }
  });

  it('denies unauthenticated access', async () => {
    const db = (await getTestEnv()).unauthenticatedContext().firestore();
    await assertFails(db.doc('teams/team-1/matches/m1').get());
    await assertFails(db.doc('teams/team-1/matches/m1').update({ status: 'live' }));
    await assertFails(db.doc('teams/team-1/matches/m1/events/e1').get());
    await assertFails(db.doc('teams/team-1/scoutProfile/usage').get());
    await assertFails(db.doc('teams/team-1/scoutProfile/usage').set({ players: {} }));
  });

  it('validates match docs', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, createdBy: 'someone-else' }));
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, status: 'paused' }));
    await assertFails(db.collection('teams/team-1/matches').add({ ...MATCH, date: 20261018 }));
    await assertFails(db.doc('teams/team-1/matches/m1').update({ status: 'paused' }));
  });

  it('validates events', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    const events = db.collection('teams/team-1/matches/m1/events');
    await assertFails(events.add({ ...ACTION, grade: '++' }));
    await assertFails(events.add({ ...ACTION, skill: 'X' }));
    await assertFails(events.add({ ...ACTION, type: 'party' }));
    await assertFails(events.add({ ...ACTION, order: '1' }));
    await assertFails(events.add({ ...ACTION, source: 'magic' }));
    await assertFails(db.doc('teams/team-1/matches/m1/events/e1').update({ grade: '++' }));
    await assertSucceeds(events.add({ type: 'point', order: 3, source: 'tap', chunkId: null, winner: 'us', reason: null }));
  });
});
