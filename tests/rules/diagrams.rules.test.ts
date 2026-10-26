import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { dbAs, getTestEnv, seedClub } from './testEnv';

const validScene = {
  v: 1,
  court: 'full',
  showZones: false,
  items: [{ id: 'a1', type: 'player', x: 20, y: 30, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle' }],
};

function diagramDoc(overrides: Record<string, unknown> = {}) {
  return { title: 'Setup', order: 0, scene: validScene, updatedBy: 'uid-coach@example.com', updatedAt: new Date(), ...overrides };
}

describe('diagrams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await seedClub(env, {
      id: 'club-a',
      admins: ['coach@example.com'],
      members: ['parent@example.com', 'exer@example.com'],
      sections: { exercises: ['exer@example.com'] },
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('clubs/club-a/exercises/ex-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'seed' });
      await db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').set(diagramDoc());
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets an admin read, create, update and delete a diagram', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').get());
    await assertSucceeds(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ title: 'Phase 1', order: 1 })));
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').update({ title: 'Setup v2' }));
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').delete());
  });

  it('denies a club member without the exercises section, a non-member and an unauthenticated caller', async () => {
    const env = await getTestEnv();
    const member = dbAs(env, 'parent@example.com');
    const outsider = dbAs(env, 'outsider@example.com');
    const anon = env.unauthenticatedContext().firestore();
    for (const [db, uid] of [[member, 'uid-parent@example.com'], [outsider, 'uid-outsider@example.com']] as const) {
      await assertFails(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').get());
      await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ updatedBy: uid })));
      await assertFails(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').update({ title: 'X', updatedBy: uid }));
      await assertFails(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').delete());
    }
    await assertFails(anon.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').get());
    await assertFails(anon.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc()));
  });

  it('lets an exercises-section member write diagrams', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'exer@example.com');
    await assertSucceeds(db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').get());
    await assertSucceeds(
      db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ updatedBy: 'uid-exer@example.com' }))
    );
  });

  it('pins updatedBy to the calling admin on create and update', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(
      db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ updatedBy: 'someone-else' })),
    );
    await assertFails(
      db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').update({ title: 'X', updatedBy: 'someone-else' }),
    );
    await assertSucceeds(
      db.doc('clubs/club-a/exercises/ex-1/diagrams/dg-1').update({ title: 'X', updatedBy: 'uid-coach@example.com' }),
    );
  });

  it('rejects writes that violate the coarse shape caps', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ title: '' })));
    await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ title: 'x'.repeat(41) })));
    await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ order: 1.5 })));
    await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, v: 2 } })));
    await assertFails(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, court: 'triangle' } })));
    await assertFails(
      db.collection('clubs/club-a/exercises/ex-1/diagrams').add(
        diagramDoc({ scene: { ...validScene, items: Array.from({ length: 61 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` })) } })
      )
    );
  });

  it('accepts a write with a full 60-item scene', async () => {
    const env = await getTestEnv();
    const db = dbAs(env, 'coach@example.com');
    const items = Array.from({ length: 60 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` }));
    await assertSucceeds(db.collection('clubs/club-a/exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, items } })));
  });
});
