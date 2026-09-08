import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const NULL_SKILLS = {
  serve: { score: null }, attack: { score: null }, set: { score: null }, defence: { score: null },
  reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
};

describe('bulk import rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('accepts a batch that creates several valid exercises', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    for (const name of ['A', 'B', 'C']) {
      batch.set(db.collection('exercises').doc(), {
        name,
        description: '',
        category: 'warmup',
        createdBy: 'admin-uid',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects the whole batch when one exercise is invalid', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('exercises').doc(), { name: 'ok', description: '', category: 'warmup', createdBy: 'admin-uid' });
    batch.set(db.collection('exercises').doc(), { name: 'bad', description: '', category: 'nonsense', createdBy: 'admin-uid' });
    await assertFails(batch.commit());
  });

  it('denies a non-admin a batch of exercise creates', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('exercises').doc(), { name: 'x', description: '', category: 'warmup', createdBy: 'viewer-uid' });
    await assertFails(batch.commit());
  });

  it('accepts a team-admin batch of valid players', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    for (const number of [4, 5]) {
      batch.set(db.collection('teams/team-1/players').doc(), {
        number,
        fullName: `Player ${number}`,
        skills: NULL_SKILLS,
        viewerEmails: [],
        consent: { given: false, date: null, confirmedBy: null },
        createdBy: 'admin-uid',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects a player batch when one skill score is out of range', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const batch = db.batch();
    batch.set(db.collection('teams/team-1/players').doc(), {
      number: 7,
      fullName: 'Good Skills',
      skills: NULL_SKILLS,
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'admin-uid',
    });
    batch.set(db.collection('teams/team-1/players').doc(), {
      number: 6,
      fullName: 'Bad Skills',
      skills: { ...NULL_SKILLS, serve: { score: 42 } },
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'admin-uid',
    });
    await assertFails(batch.commit());
  });
});
