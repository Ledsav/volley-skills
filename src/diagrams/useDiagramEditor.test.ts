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

describe('moveEndpoint', () => {
  it('moves only arrow endpoint 0 (from) or endpoint 1 (to)', () => {
    const arrow = { ...createItem('arrow', { x: 0, y: 0 }), id: 'a' };
    let s = diagramReducer(loaded(), { type: 'addItem', item: arrow });
    const a0 = s.diagrams[0].scene.items[0];
    if (a0.type !== 'arrow') throw new Error('expected an arrow');
    const to0 = { ...a0.to };

    s = diagramReducer(s, { type: 'moveEndpoint', id: 'a', index: 0, x: 5, y: 7 });
    let ia = s.diagrams[0].scene.items[0];
    if (ia.type !== 'arrow') throw new Error('expected an arrow');
    expect(ia.from).toEqual({ x: 5, y: 7 });
    expect(ia.to).toEqual(to0);

    s = diagramReducer(s, { type: 'moveEndpoint', id: 'a', index: 1, x: 20, y: 30 });
    ia = s.diagrams[0].scene.items[0];
    if (ia.type !== 'arrow') throw new Error('expected an arrow');
    expect(ia.from).toEqual({ x: 5, y: 7 });
    expect(ia.to).toEqual({ x: 20, y: 30 });
  });

  it('ignores an out-of-range endpoint index on an arrow (same state reference)', () => {
    const arrow = { ...createItem('arrow', { x: 0, y: 0 }), id: 'a' };
    const s = diagramReducer(loaded(), { type: 'addItem', item: arrow });
    expect(diagramReducer(s, { type: 'moveEndpoint', id: 'a', index: 2, x: 1, y: 1 })).toBe(s);
  });

  it('moves only points[index] on a line, leaving the other points untouched', () => {
    const line = {
      ...createItem('line', { x: 0, y: 0 }),
      id: 'l',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ],
    };
    let s = diagramReducer(loaded(), { type: 'addItem', item: line });
    s = diagramReducer(s, { type: 'moveEndpoint', id: 'l', index: 1, x: 12, y: 8 });
    const il = s.diagrams[0].scene.items[0];
    if (il.type !== 'line') throw new Error('expected a line');
    expect(il.points).toEqual([
      { x: 0, y: 0 },
      { x: 12, y: 8 },
      { x: 20, y: 0 },
    ]);
  });

  it('ignores an out-of-range index on a line (same state reference)', () => {
    const line = { ...createItem('line', { x: 0, y: 0 }), id: 'l' };
    const s = diagramReducer(loaded(), { type: 'addItem', item: line });
    expect(diagramReducer(s, { type: 'moveEndpoint', id: 'l', index: 5, x: 1, y: 1 })).toBe(s);
    expect(diagramReducer(s, { type: 'moveEndpoint', id: 'l', index: -1, x: 1, y: 1 })).toBe(s);
  });

  it('is a no-op for a point item like a cone (same state reference)', () => {
    const cone = { ...createItem('cone', { x: 5, y: 5 }), id: 'c' };
    const s = diagramReducer(loaded(), { type: 'addItem', item: cone });
    expect(diagramReducer(s, { type: 'moveEndpoint', id: 'c', index: 0, x: 9, y: 9 })).toBe(s);
  });

  it('moving an endpoint to its current position burns no undo frame (same state reference)', () => {
    const arrow = { ...createItem('arrow', { x: 0, y: 0 }), id: 'a' };
    const s = diagramReducer(loaded(), { type: 'addItem', item: arrow });
    const a0 = s.diagrams[0].scene.items[0];
    if (a0.type !== 'arrow') throw new Error('expected an arrow');
    const undoLen = s.undo.length;
    const next = diagramReducer(s, {
      type: 'moveEndpoint',
      id: 'a',
      index: 1,
      x: a0.to.x,
      y: a0.to.y,
    });
    expect(next).toBe(s);
    expect(next.undo.length).toBe(undoLen);
  });
});

describe('multi-selection', () => {
  function threeItems(): EditorState {
    const a = { ...createItem('cone', { x: 10, y: 10 }), id: 'a' };
    const b = { ...createItem('cone', { x: 20, y: 20 }), id: 'b' };
    const c = { ...createItem('line', { x: 0, y: 0 }), id: 'c' };
    let s = loaded();
    for (const item of [a, b, c]) s = diagramReducer(s, { type: 'addItem', item });
    return s;
  }

  it('selectItem replaces the selection; null clears it', () => {
    let s = diagramReducer(loaded(), {
      type: 'addItem',
      item: { ...createItem('cone', { x: 1, y: 1 }), id: 'a' },
    });
    s = diagramReducer(s, { type: 'selectItem', id: 'a' });
    expect(s.selectedIds).toEqual(['a']);
    expect(s.selectedItemId).toBe('a');
    s = diagramReducer(s, { type: 'selectItem', id: null });
    expect(s.selectedIds).toEqual([]);
    expect(s.selectedItemId).toBeNull();
  });

  it('toggleSelect adds then removes an id; two ids => selectedItemId null', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: null });
    s = diagramReducer(s, { type: 'toggleSelect', id: 'a' });
    expect(s.selectedIds).toEqual(['a']);
    expect(s.selectedItemId).toBe('a');
    s = diagramReducer(s, { type: 'toggleSelect', id: 'b' });
    expect(s.selectedIds).toEqual(['a', 'b']);
    expect(s.selectedItemId).toBeNull();
    s = diagramReducer(s, { type: 'toggleSelect', id: 'a' });
    expect(s.selectedIds).toEqual(['b']);
    expect(s.selectedItemId).toBe('b');
  });

  it('selectAll selects every item id in scene order', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: null });
    s = diagramReducer(s, { type: 'selectAll' });
    expect(s.selectedIds).toEqual(['a', 'b', 'c']);
    expect(s.selectedItemId).toBeNull();
  });

  it('selectAll on an empty scene clears the selection', () => {
    const s = diagramReducer(loaded(), { type: 'selectAll' });
    expect(s.selectedIds).toEqual([]);
  });

  it('addToSelection unions new ids into the current selection without duplicates', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: 'a' });
    s = diagramReducer(s, { type: 'addToSelection', ids: ['a', 'b', 'c'] });
    expect(s.selectedIds).toEqual(['a', 'b', 'c']);
    expect(s.selectedItemId).toBeNull();
  });

  it('addToSelection with an empty list is a no-op (same state reference)', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: 'a' });
    expect(diagramReducer(s, { type: 'addToSelection', ids: [] })).toBe(s);
  });

  it('deleteSelected removes every selected item in one undo frame and clears the selection', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: 'a' });
    s = diagramReducer(s, { type: 'toggleSelect', id: 'b' });
    const undoLen = s.undo.length;
    s = diagramReducer(s, { type: 'deleteSelected' });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['c']);
    expect(s.undo.length).toBe(undoLen + 1);
    expect(s.selectedIds).toEqual([]);
    expect(s.selectedItemId).toBeNull();
  });

  it('deleteSelected with nothing selected is a no-op (same state reference)', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: null });
    expect(diagramReducer(s, { type: 'deleteSelected' })).toBe(s);
  });

  it('translateSelected moves each selected item, shifts every line point, and leaves others alone', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: 'a' });
    s = diagramReducer(s, { type: 'toggleSelect', id: 'c' });
    const undoLen = s.undo.length;
    s = diagramReducer(s, { type: 'translateSelected', dx: 5, dy: -3 });
    const items = s.diagrams[0].scene.items;
    const ia = items.find((i) => i.id === 'a')!;
    expect({ x: ia.x, y: ia.y }).toEqual({ x: 15, y: 7 });
    const ib = items.find((i) => i.id === 'b')!;
    expect({ x: ib.x, y: ib.y }).toEqual({ x: 20, y: 20 });
    const ic = items.find((i) => i.id === 'c')!;
    if (ic.type !== 'line') throw new Error('expected a line');
    expect(ic.points).toEqual([
      { x: 5, y: -3 },
      { x: 20, y: -3 },
    ]);
    expect(s.undo.length).toBe(undoLen + 1);
  });

  it('translateSelected with a zero delta is a no-op (same state reference)', () => {
    const s = threeItems();
    expect(diagramReducer(s, { type: 'translateSelected', dx: 0, dy: 0 })).toBe(s);
  });

  it('translateSelected with nothing selected is a no-op (same state reference)', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectItem', id: null });
    expect(diagramReducer(s, { type: 'translateSelected', dx: 3, dy: 3 })).toBe(s);
  });

  it('addItem makes the new item the sole selection', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectAll' });
    s = diagramReducer(s, { type: 'addItem', item: { ...createItem('ball', { x: 9, y: 9 }), id: 'd' } });
    expect(s.selectedIds).toEqual(['d']);
    expect(s.selectedItemId).toBe('d');
  });

  it('pasteItems appends all items, selects them, in one undo frame', () => {
    let s = threeItems();
    const undoLen = s.undo.length;
    const clones = ['p1', 'p2', 'p3'].map((id) => ({ ...createItem('cone', { x: 1, y: 1 }), id }));
    s = diagramReducer(s, { type: 'pasteItems', items: clones });
    expect(s.diagrams[0].scene.items.map((i) => i.id)).toEqual(['a', 'b', 'c', 'p1', 'p2', 'p3']);
    expect(s.selectedIds).toEqual(['p1', 'p2', 'p3']);
    expect(s.selectedItemId).toBeNull();
    expect(s.undo.length).toBe(undoLen + 1);
  });

  it('pasteItems only appends what fits under the item cap', () => {
    let s = loaded();
    for (let i = 0; i < 58; i += 1) {
      s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: i, y: i }), id: `x${i}` } });
    }
    const clones = Array.from({ length: 5 }, (_, i) => ({ ...createItem('cone', { x: i, y: i }), id: `c${i}` }));
    s = diagramReducer(s, { type: 'pasteItems', items: clones });
    expect(s.diagrams[0].scene.items).toHaveLength(60);
    expect(s.selectedIds).toEqual(['c0', 'c1']);
  });

  it('pasteItems with an empty list is a no-op (same state reference)', () => {
    const s = threeItems();
    expect(diagramReducer(s, { type: 'pasteItems', items: [] })).toBe(s);
  });

  it('selectDiagram resets the selection to empty', () => {
    let s = diagramReducer(loaded(), { type: 'addDiagram' });
    const d2 = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'selectDiagram', id: 'd1' });
    s = diagramReducer(s, { type: 'addItem', item: { ...createItem('cone', { x: 1, y: 1 }), id: 'z' } });
    expect(s.selectedIds).toEqual(['z']);
    s = diagramReducer(s, { type: 'selectDiagram', id: d2 });
    expect(s.selectedIds).toEqual([]);
    expect(s.selectedItemId).toBeNull();
  });

  it('undo and redo reset the selection to empty', () => {
    let s = threeItems();
    s = diagramReducer(s, { type: 'selectAll' });
    expect(s.selectedIds).toEqual(['a', 'b', 'c']);
    s = diagramReducer(s, { type: 'undo' });
    expect(s.selectedIds).toEqual([]);
    s = diagramReducer(s, { type: 'selectAll' });
    s = diagramReducer(s, { type: 'redo' });
    expect(s.selectedIds).toEqual([]);
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
