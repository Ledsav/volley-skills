import { assertFails, assertSucceeds, type RulesTestContext } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

const NULL_SKILLS = {
  serve: { score: null }, attack: { score: null }, block: { score: null }, set: { score: null }, defence: { score: null },
  reception: { score: null }, jump: { score: null }, speed: { score: null }, iq: { score: null },
};

describe('bulk import rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'trainer@example.com'],
      sections: { trainings: ['trainer@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/teams/team-1').set({ name: 'U17', adminEmails: ['coach@example.com'] });
      await db.doc('clubs/club-a/counters/trainings').set({ lastSequence: 6 });
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('accepts a batch that creates several valid exercises', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    const batch = db.batch();
    for (const name of ['A', 'B', 'C']) {
      batch.set(db.collection('clubs/club-a/exercises').doc(), {
        name,
        description: '',
        category: 'warmup',
        createdBy: 'uid-coach@example.com',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects the whole batch when one exercise is invalid', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    const batch = db.batch();
    batch.set(db.collection('clubs/club-a/exercises').doc(), { name: 'ok', description: '', category: 'warmup', createdBy: 'uid-coach@example.com' });
    batch.set(db.collection('clubs/club-a/exercises').doc(), { name: 'bad', description: '', category: 'nonsense', createdBy: 'uid-coach@example.com' });
    await assertFails(batch.commit());
  });

  it('denies a member without the exercises section a batch of exercise creates', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    const batch = db.batch();
    batch.set(db.collection('clubs/club-a/exercises').doc(), { name: 'x', description: '', category: 'warmup', createdBy: 'uid-parent@example.com' });
    await assertFails(batch.commit());
  });

  it('accepts a club-admin batch of valid players', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    const batch = db.batch();
    for (const number of [4, 5]) {
      batch.set(db.collection('clubs/club-a/teams/team-1/players').doc(), {
        number,
        fullName: `Player ${number}`,
        skills: NULL_SKILLS,
        viewerEmails: [],
        consent: { given: false, date: null, confirmedBy: null },
        createdBy: 'uid-coach@example.com',
      });
    }
    await assertSucceeds(batch.commit());
  });

  it('rejects a player batch when one skill score is out of range', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    const batch = db.batch();
    batch.set(db.collection('clubs/club-a/teams/team-1/players').doc(), {
      number: 7,
      fullName: 'Good Skills',
      skills: NULL_SKILLS,
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'uid-coach@example.com',
    });
    batch.set(db.collection('clubs/club-a/teams/team-1/players').doc(), {
      number: 6,
      fullName: 'Bad Skills',
      skills: { ...NULL_SKILLS, serve: { score: 42 } },
      viewerEmails: [],
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: 'uid-coach@example.com',
    });
    await assertFails(batch.commit());
  });

  // Mirrors bulkCreateTrainings: one transaction reads the counter, creates
  // every training with its derived businessId, then bumps the counter.
  function bulkCreateTrainings(db: ReturnType<RulesTestContext['firestore']>, uid: string, names: string[]) {
    return db.runTransaction(async (tx) => {
      const counterRef = db.doc('clubs/club-a/counters/trainings');
      const snap = await tx.get(counterRef);
      const last = (snap.data()?.lastSequence as number | undefined) ?? 0;
      names.forEach((name, i) => {
        tx.set(db.collection('clubs/club-a/trainings').doc(), {
          businessId: `TR-${String(last + i + 1).padStart(4, '0')}`,
          name,
          description: '',
          ageGroupTarget: '',
          exercises: [],
          exerciseIds: [],
          createdBy: uid,
        });
      });
      tx.set(counterRef, { lastSequence: last + names.length });
    });
  }

  async function counterValue(): Promise<number> {
    const env = await getTestEnv();
    let value = -1;
    await env.withSecurityRulesDisabled(async (context) => {
      value = (await context.firestore().doc('clubs/club-a/counters/trainings').get()).data()?.lastSequence;
    });
    return value;
  }

  it('accepts a trainings-section admin transaction that creates several trainings and bumps the counter', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'trainer@example.com');
    await assertSucceeds(bulkCreateTrainings(db, 'uid-trainer@example.com', ['A', 'B', 'C']));
    expect(await counterValue()).toBe(9);
  });

  it('accepts the same transaction from a club admin', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(bulkCreateTrainings(db, 'uid-coach@example.com', ['A', 'B']));
    expect(await counterValue()).toBe(8);
  });

  it('rejects the whole training transaction when one training is invalid, leaving the counter alone', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'trainer@example.com');
    await assertFails(bulkCreateTrainings(db, 'uid-trainer@example.com', ['ok', '']));
    expect(await counterValue()).toBe(6);
  });

  it('rejects a training transaction that claims another creator', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'trainer@example.com');
    await assertFails(bulkCreateTrainings(db, 'someone-else', ['A']));
  });

  it('denies a member without the trainings section the bulk training transaction', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'parent@example.com');
    await assertFails(bulkCreateTrainings(db, 'uid-parent@example.com', ['A']));
    expect(await counterValue()).toBe(6);
  });
});
