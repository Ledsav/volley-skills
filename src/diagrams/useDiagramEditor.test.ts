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

  it('saved swaps temp ids for real ids and clears dirty/deleted', () => {
    let s = loaded();
    s = diagramReducer(s, { type: 'addDiagram' });
    const tempId = s.activeDiagramId!;
    s = diagramReducer(s, { type: 'deleteDiagram', id: 'd1' });
    s = diagramReducer(s, { type: 'saved', idMap: { [tempId]: 'real-9' } });
    expect(s.diagrams[0].id).toBe('real-9');
    expect(s.diagrams[0].persisted).toBe(true);
    expect(s.dirtyIds.size).toBe(0);
    expect(s.deletedIds).toEqual([]);
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
  });
});
