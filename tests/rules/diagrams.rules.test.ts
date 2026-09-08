import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { afterAll, beforeEach, describe, it } from 'vitest';
import { getTestEnv } from './testEnv';

const validScene = {
  v: 1,
  court: 'full',
  showZones: false,
  items: [{ id: 'a1', type: 'player', x: 20, y: 30, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle' }],
};

function diagramDoc(overrides: Record<string, unknown> = {}) {
  return { title: 'Setup', order: 0, scene: validScene, updatedBy: 'admin-uid', updatedAt: new Date(), ...overrides };
}

describe('diagrams rules', () => {
  beforeEach(async () => {
    const env = await getTestEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('users/admin-uid').set({ email: 'coach@example.com', role: 'admin' });
      await db.doc('users/viewer-uid').set({ email: 'parent@example.com', role: 'viewer' });
      await db.doc('exercises/ex-1').set({ name: 'Pepper', description: '', category: 'warmup', createdBy: 'admin-uid' });
      await db.doc('exercises/ex-1/diagrams/dg-1').set(diagramDoc());
    });
  });

  afterAll(async () => {
    const env = await getTestEnv();
    await env.cleanup();
  });

  it('lets an admin read, create, update and delete a diagram', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').get());
    await assertSucceeds(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: 'Phase 1', order: 1 })));
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').update({ title: 'Setup v2' }));
    await assertSucceeds(db.doc('exercises/ex-1/diagrams/dg-1').delete());
  });

  it('denies a viewer and denies an unauthenticated caller', async () => {
    const env = await getTestEnv();
    const viewer = env.authenticatedContext('viewer-uid', { email: 'parent@example.com' }).firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(viewer.doc('exercises/ex-1/diagrams/dg-1').get());
    await assertFails(viewer.collection('exercises/ex-1/diagrams').add(diagramDoc()));
    await assertFails(anon.doc('exercises/ex-1/diagrams/dg-1').get());
  });

  it('rejects writes that violate the coarse shape caps', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: '' })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ title: 'x'.repeat(41) })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ order: 1.5 })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, v: 2 } })));
    await assertFails(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, court: 'triangle' } })));
    await assertFails(
      db.collection('exercises/ex-1/diagrams').add(
        diagramDoc({ scene: { ...validScene, items: Array.from({ length: 61 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` })) } })
      )
    );
  });

  it('accepts a write with a full 60-item scene', async () => {
    const env = await getTestEnv();
    const db = env.authenticatedContext('admin-uid', { email: 'coach@example.com' }).firestore();
    const items = Array.from({ length: 60 }, (_, i) => ({ ...validScene.items[0], id: `i${i}` }));
    await assertSucceeds(db.collection('exercises/ex-1/diagrams').add(diagramDoc({ scene: { ...validScene, items } })));
  });
});
