import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const CONFIG = { picks: {}, custom: [], order: [], updatedBy: 'coach-uid', updatedAt: new Date() };
const custom = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, title: 'Spirit', playerId: 'p1', note: '' }));

describe('awards rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('adminAllowlist/super@example.com').set({});
      await db.doc('users/super-uid').set({ role: 'superadmin', email: 'super@example.com' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('teams/team-1/players/p1').set({ fullName: 'P', viewerEmails: ['parent@example.com'] });
      await db.doc('teams/team-1/awards/season').set(CONFIG);
    });
  });

  afterAll(async () => {
    await (await getTestEnv()).cleanup();
  });

  const as = async (uid: string, email: string) => (await getTestEnv()).authenticatedContext(uid, { email }).firestore();

  it('team admin reads and writes the season awards', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertSucceeds(db.doc('teams/team-1/awards/season').get());
    await assertSucceeds(db.doc('teams/team-1/awards/season').set({ ...CONFIG, custom: custom(5) }));
  });

  it('superadmin can write', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('teams/team-1/awards/season').set(CONFIG));
  });

  it('viewer (guardian) and outsiders cannot read or write', async () => {
    for (const [uid, email] of [['parent-uid', 'parent@example.com'], ['x-uid', 'x@example.com']]) {
      const db = await as(uid, email);
      await assertFails(db.doc('teams/team-1/awards/season').get());
      await assertFails(db.doc('teams/team-1/awards/season').set(CONFIG));
    }
  });

  it('superadmin can read', async () => {
    const db = await as('super-uid', 'super@example.com');
    await assertSucceeds(db.doc('teams/team-1/awards/season').get());
  });

  it('viewer (guardian) and outsiders cannot delete', async () => {
    for (const [uid, email] of [['parent-uid', 'parent@example.com'], ['x-uid', 'x@example.com']]) {
      const db = await as(uid, email);
      await assertFails(db.doc('teams/team-1/awards/season').delete());
    }
  });

  it('only the "season" doc id is allowed', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.doc('teams/team-1/awards/other').set(CONFIG));
  });

  it('rejects more than 5 custom awards and bad shapes', async () => {
    const db = await as('coach-uid', 'coach@example.com');
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, custom: custom(6) }));
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, picks: 'x' }));
    await assertFails(db.doc('teams/team-1/awards/season').set({ ...CONFIG, order: 'x' }));
  });
});
