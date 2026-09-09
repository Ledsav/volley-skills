import { describe, expect, it } from 'vitest';
import { diagramReducer, initialEditorState, buildSaveOps, type EditorState } from './useDiagramEditor';
import { emptyScene, createItem } from './sceneFactory';
import type { Scene } from '../types/diagram';

function loaded(scene: Scene = emptyScene('full')): EditorState {
  return diagramReducer(initialEditorState, {
    type: 'loaded',
    diagrams: [{ id: 'd1', persisted: true, title: 'Setup', order: 0, scene }],
  });
}

describe('diagramReducer', () => {
  it('loads diagrams and activates the first', () => {
    const s = loaded();
    expect(s.activeDiagramId).toBe('d1');
    expect(s.dirtyIds.size).toBe(0);
  });

  it('addItem appends the item, selects it, and marks the diagram dirty', () => {
    const item = createItem('player', { x: 20, y: 20 });
    const s = diagramReducer(loaded(), { type: 'addItem', item });
    expect(s.diagrams[0].scene.items).toEqual([item]);
    expect(s.selectedItemId).toBe(item.id);
    expect(s.dirtyIds.has('d1')).toBe(true);
  });

  it('translateItem shifts a point item, every line point, and both arrow endpoints', () => {
    const cone = { ...createItem('cone', { x: 10, y: 10 }), id: 'c' };
    const line = { ...createItem('line', { x: 0, y: 0 }), id: 'l' };
    const arrow = { ...createItem('arrow', { x: 0, y: 0 }), id: 'a' };
    let s = loaded();
    for (const item of [cone, line, arrow]) s = diagramReducer(s, { type: 'addItem', item });

    const l0 = line.type === 'line' ? line.points.map((p) => ({ ...p })) : [];
    const from0 = arrow.type === 'arrow' ? { ...arrow.from } : { x: 0, y: 0 };
    const to0 = arrow.type === 'arrow' ? { ...arrow.to } : { x: 0, y: 0 };

    s = diagramReducer(s, { type: 'translateItem', id: 'c', dx: 5, dy: -3 });
    s = diagramReducer(s, { type: 'translateItem', id: 'l', dx: 5, dy: -3 });
    s = diagramReducer(s, { type: 'translateItem', id: 'a', dx: 5, dy: -3 });

    const items = s.diagrams[0].scene.items;
    const ic = items.find((i) => i.id === 'c')!;
    expect({ x: ic.x, y: ic.y }).toEqual({ x: 15, y: 7 });
    const il = items.find((i) => i.id === 'l')!;
    if (il.type !== 'line') throw new Error('expected a line');
    expect(il.points).toEqual(l0.map((p) => ({ x: p.x + 5, y: p.y - 3 })));
    const ia = items.find((i) => i.id === 'a')!;
    if (ia.type !== 'arrow') throw new Error('expected an arrow');
    expect(ia.from).toEqual({ x: from0.x + 5, y: from0.y - 3 });
    expect(ia.to).toEqual({ x: to0.x + 5, y: to0.y - 3 });
  });

  it('translateItem with a zero delta is a no-op (same state reference, no undo frame)', () => {
    const s = diagramReducer(loaded(), { type: 'addItem', item: { ...createItem('cone', { x: 5, y: 5 }), id: 'c' } });
    const undoLen = s.undo.length;
    const next = diagramReducer(s, { type: 'translateItem', id: 'c', dx: 0, dy: 0 });
    expect(next).toBe(s);
    expect(next.undo.length).toBe(undoLen);
  });

  it('moveItem / transformItem / setItemProp mutate only the target item', () => {
    const a = { ...createItem('cone', { x: 10, y: 10 }), id: 'a' };
    const b = { ...createItem('cone', { x: 50, y: 50 }), id: 'b' };
    let s = diagramReducer(loaded(), { type: 'addItem', item: a });
    s = diagramReducer(s, { type: 'addItem', item: b });
    s = diagramReducer(s, { type: 'moveItem', id: 'a', x: 15, y: 25 });
    s = diagramReducer(s, { type: 'transformItem', id: 'a', rotation: 90, size: 1.5 });
    s = diagramReducer(s, { type: 'setItemProp', id: 'a', patch: { color: 'green' } });
    const [ia, ib] = s.diagrams[0].scene.items;
    expect(ia).toMatchObject({ id: 'a', x: 15, y: 25, rotation: 90, size: 1.5, color: 'green' });
    expect(ib).toMatchObject({ id: 'b', x: 50, y: 50, rotation: 0 });
  });

  it('deleteItem removes the item and clears the selection', () => {
    const a = { ...createItem('ball', { x: 10, y: 10 }), id: 'a' };
    let s = diagramReducer(loaded(), { type: 'addItem', item: a });
    s = diagramReducer(s, { type: 'deleteItem', id: 'a' });
    expect(s.diagrams[0].scene.items).toHaveLength(0);
    expect(s.selectedItemId).toBeNull();
  });

  it('reorderItem moves an item within the z-order array', () => {
    const ids = ['a', 'b', 'c'];
    let s = loaded();
    for (const id of ids) s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id } });
    s = diagramReducer(s, { type: 'reorderItem', id: 'a', to: 'front' });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['b', 'c', 'a']);
    s = diagramReducer(s, { type: 'reorderItem', id: 'a', to: 'backward' });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });

  it('addDiagram appends up to the cap then no-ops', () => {
    let s = loaded();
    for (let i = 0; i < 20; i += 1) s = diagramReducer(s, { type: 'addDiagram' });
    expect(s.diagrams).toHaveLength(12);
    expect(s.diagrams[11].persisted).toBe(false);
    expect(s.activeDiagramId).toBe(s.diagrams[11].id);
  });

  it('deleteDiagram on a persisted diagram records it in deletedIds and re-points active', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const newId = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    expect(s.deletedIds).toEqual(['d1']);
    expect(s.diagrams.map((d) => d.id)).toEqual([newId]);
    s = diagramReducer(s, { type: 'deleteDiagram', id: newId });
    expect(s.deletedIds).toEqual(['d1']); // unsaved-new one not recorded
  });

  it('deleteDiagram re-dirties survivors whose order actually shifted', () => {
    let s = diagramReducer(initialEditorState, {
      type: 'loaded',
      diagrams: [
        { id: 'a', persisted: true, title: 'A', order: 0, scene: emptyScene('full') },
        { id: 'b', persisted: true, title: 'B', order: 1, scene: emptyScene('full') },
        { id: 'c', persisted: true, title: 'C', order: 2, scene: emptyScene('full') },
      ],
    });
    // Delete the middle one: 'a' keeps order 0, 'c' shifts 2 -> 1.
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'b' });
    expect(s.dirtyIds.has('a')).toBe(false);
    expect(s.dirtyIds.has('c')).toBe(true);
    expect(s.diagrams.map((d) => [d.id, d.order])).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
  });

  it('undo restores the previous scene and redo reapplies; stack caps at 30', () => {
    let s = loaded();
    for (let i = 0; i < 35; i += 1) {
      s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: i, y: i }), id: `c${i}` } });
    }
    expect(s.undo).toHaveLength(30);
    const count = s.diagrams[0].scene.items.length;
    s = diagramReducer(s, { type: 'undo' });
    expect(s.diagrams[0].scene.items.length).toBe(count - 1);
    s = diagramReducer(s, { type: 'redo' });
    expect(s.diagrams[0].scene.items.length).toBe(count);
  });

  it('setCourt and toggleZones mutate the active scene and mark it dirty', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'setCourt', court: 'blank' });
    s = diagramReducer(s, { type: 'toggleZones' });
    expect(s.diagrams[0].scene.court).toBe('blank');
    expect(s.diagrams[0].scene.showZones).toBe(true);
    expect(s.dirtyIds.has('d1')).toBe(true);
  });

  it('saved swaps temp ids for real ids and clears dirty/deleted for the committed set', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const tempId = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    s = diagramReducer(s, {
      type: 'saved',
      idMap: { [tempId]: 'real-9' },
      committedIds: ['d1', tempId],
    });
    expect(s.diagrams[0].id).toBe('real-9');
    expect(s.diagrams[0].persisted).toBe(true);
    expect(s.dirtyIds.size).toBe(0);
    expect(s.deletedIds).toEqual([]);
    expect(s.activeDiagramId).toBe('real-9');
    expect(s.diagrams.find((d) => d.id === s.activeDiagramId)).toBeTruthy();
  });

  it('saved only cleans the committed diagrams; edits made during the save stay dirty', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const bId = s.activeDiagramId!;
    // Edit A (the persisted d1) — this is what buildSaveOps captures.
    s = diagramReducer(s, { type: 'selectDiagram', id: 'd1' });
    s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'ca' } });
    const ops = buildSaveOps(s);
    expect(ops.updates.map((u) => u.id)).toEqual(['d1']);
    // Edit B while the save is "in flight".
    s = diagramReducer(s, { type: 'selectDiagram', id: bId });
    s = diagramReducer(s, { type: 'addItem', item: { ...createItem('ball', { x: 2, y: 2 }), id: 'bb' } });
    // The save resolves — only A (d1) was committed.
    s = diagramReducer(s, { type: 'saved', idMap: {}, committedIds: ['d1'] });
    expect(s.dirtyIds.has('d1')).toBe(false);
    expect(s.dirtyIds.has(bId)).toBe(true);
    expect(s.diagrams.find((d) => d.id === bId)?.persisted).toBe(false);
  });
});

describe('buildSaveOps', () => {
  it('splits diagrams into creates (unpersisted), updates (persisted + dirty) and deletes', () => {
    let s2 = loaded();
    s2 = diagramReducer(s2, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'x' } });
    s2 = diagramReducer(s2, { type: 'addDiagram' });
    const ops = buildSaveOps(s2);
    expect(ops.updates.map((u) => u.id)).toEqual(['d1']);
    expect(ops.creates).toHaveLength(1);
    expect(ops.deletes).toEqual([]);

    let s3 = loaded();
    s3 = diagramReducer(s3, { type: 'addDiagram' });
    s3 = diagramReducer(s3, { type: 'deleteDiagram', id: 'd1' });
    expect(buildSaveOps(s3).deletes).toEqual(['d1']);
  });
});
