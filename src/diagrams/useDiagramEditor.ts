import { useCallback, useEffect, useReducer, useState } from 'react';
import { SCENE_LIMITS, type CourtPreset, type DiagramItem, type Scene } from '../types/diagram';
import { emptyScene, newId } from './sceneFactory';
import { listDiagrams, saveDiagramSet, type DiagramSaveOps } from './diagramsApi';

const UNDO_LIMIT = 30;

export interface EditorDiagram {
  id: string;
  persisted: boolean;
  title: string;
  order: number;
  scene: Scene;
}

export interface EditorState {
  diagrams: EditorDiagram[];
  activeDiagramId: string | null;
  selectedItemId: string | null;
  dirtyIds: Set<string>;
  deletedIds: string[];
  undo: Scene[];
  redo: Scene[];
}

export type EditorAction =
  | { type: 'loaded'; diagrams: EditorDiagram[] }
  | { type: 'selectDiagram'; id: string }
  | { type: 'addDiagram' }
  | { type: 'renameDiagram'; id: string; title: string }
  | { type: 'reorderDiagram'; id: string; direction: 'left' | 'right' }
  | { type: 'deleteDiagram'; id: string }
  | { type: 'selectItem'; id: string | null }
  | { type: 'addItem'; item: DiagramItem }
  | { type: 'moveItem'; id: string; x: number; y: number }
  | { type: 'transformItem'; id: string; rotation: number; size: number }
  | { type: 'setItemProp'; id: string; patch: Partial<DiagramItem> }
  | { type: 'deleteItem'; id: string }
  | { type: 'reorderItem'; id: string; to: 'front' | 'back' | 'forward' | 'backward' }
  | { type: 'setCourt'; court: CourtPreset }
  | { type: 'toggleZones' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'saved'; idMap: Record<string, string> };

export const initialEditorState: EditorState = {
  diagrams: [],
  activeDiagramId: null,
  selectedItemId: null,
  dirtyIds: new Set(),
  deletedIds: [],
  undo: [],
  redo: [],
};

function reorderZ(
  items: DiagramItem[],
  id: string,
  to: 'front' | 'back' | 'forward' | 'backward',
): DiagramItem[] {
  const i = items.findIndex((it) => it.id === id);
  if (i < 0) return items;
  const next = items.slice();
  const [it] = next.splice(i, 1);
  const j =
    to === 'front'
      ? next.length
      : to === 'back'
        ? 0
        : to === 'forward'
          ? Math.min(next.length, i + 1)
          : Math.max(0, i - 1);
  next.splice(j, 0, it);
  return next;
}

/** Apply `mutate` to the active diagram's scene, recording undo + dirty. */
function mutateActive(state: EditorState, mutate: (scene: Scene) => Scene): EditorState {
  const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
  if (!active) return state;
  const nextScene = mutate(active.scene);
  if (nextScene === active.scene) return state;
  return {
    ...state,
    diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: nextScene } : d)),
    dirtyIds: new Set(state.dirtyIds).add(active.id),
    undo: [...state.undo, active.scene].slice(-UNDO_LIMIT),
    redo: [],
  };
}

function patchItems(scene: Scene, id: string, fn: (item: DiagramItem) => DiagramItem): Scene {
  return { ...scene, items: scene.items.map((it) => (it.id === id ? fn(it) : it)) };
}

export function diagramReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'loaded': {
      const sorted = [...action.diagrams].sort((a, b) => a.order - b.order);
      return { ...initialEditorState, diagrams: sorted, activeDiagramId: sorted[0]?.id ?? null };
    }
    case 'selectDiagram':
      return { ...state, activeDiagramId: action.id, selectedItemId: null, undo: [], redo: [] };
    case 'addDiagram': {
      if (state.diagrams.length >= SCENE_LIMITS.diagramsPerExercise) return state;
      const n = state.diagrams.length;
      const id = `new:${newId()}`;
      const diagram: EditorDiagram = {
        id,
        persisted: false,
        title: `Diagram ${n + 1}`,
        order: n,
        scene: emptyScene('full'),
      };
      return {
        ...state,
        diagrams: [...state.diagrams, diagram],
        activeDiagramId: id,
        selectedItemId: null,
        dirtyIds: new Set(state.dirtyIds).add(id),
        undo: [],
        redo: [],
      };
    }
    case 'renameDiagram':
      return {
        ...state,
        diagrams: state.diagrams.map((d) =>
          d.id === action.id ? { ...d, title: action.title.slice(0, SCENE_LIMITS.titleLength) } : d,
        ),
        dirtyIds: new Set(state.dirtyIds).add(action.id),
      };
    case 'reorderDiagram': {
      const i = state.diagrams.findIndex((d) => d.id === action.id);
      const j = action.direction === 'left' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= state.diagrams.length) return state;
      const next = state.diagrams.slice();
      [next[i], next[j]] = [next[j], next[i]];
      const renumbered = next.map((d, k) => ({ ...d, order: k }));
      const dirtyIds = new Set(state.dirtyIds);
      renumbered.forEach((d) => dirtyIds.add(d.id));
      return { ...state, diagrams: renumbered, dirtyIds };
    }
    case 'deleteDiagram': {
      const target = state.diagrams.find((d) => d.id === action.id);
      if (!target) return state;
      const diagrams = state.diagrams
        .filter((d) => d.id !== action.id)
        .map((d, k) => ({ ...d, order: k }));
      const dirtyIds = new Set(state.dirtyIds);
      dirtyIds.delete(action.id);
      return {
        ...state,
        diagrams,
        dirtyIds,
        deletedIds: target.persisted ? [...state.deletedIds, action.id] : state.deletedIds,
        activeDiagramId:
          state.activeDiagramId === action.id ? diagrams[0]?.id ?? null : state.activeDiagramId,
        selectedItemId: null,
        undo: [],
        redo: [],
      };
    }
    case 'selectItem':
      return { ...state, selectedItemId: action.id };
    case 'addItem': {
      const next = mutateActive(state, (scene) =>
        scene.items.length >= SCENE_LIMITS.itemsPerScene
          ? scene
          : { ...scene, items: [...scene.items, action.item] },
      );
      return next === state ? state : { ...next, selectedItemId: action.item.id };
    }
    case 'moveItem':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, x: action.x, y: action.y })),
      );
    case 'transformItem':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, rotation: action.rotation, size: action.size })),
      );
    case 'setItemProp':
      return mutateActive(state, (scene) =>
        patchItems(scene, action.id, (it) => ({ ...it, ...action.patch }) as DiagramItem),
      );
    case 'deleteItem': {
      const next = mutateActive(state, (scene) => ({
        ...scene,
        items: scene.items.filter((it) => it.id !== action.id),
      }));
      return next === state ? state : { ...next, selectedItemId: null };
    }
    case 'reorderItem':
      return mutateActive(state, (scene) => ({
        ...scene,
        items: reorderZ(scene.items, action.id, action.to),
      }));
    case 'setCourt':
      return mutateActive(state, (scene) =>
        scene.court === action.court ? scene : { ...scene, court: action.court },
      );
    case 'toggleZones':
      return mutateActive(state, (scene) => ({ ...scene, showZones: !scene.showZones }));
    case 'undo': {
      const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
      if (!active || state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1];
      return {
        ...state,
        diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: prev } : d)),
        undo: state.undo.slice(0, -1),
        redo: [...state.redo, active.scene].slice(-UNDO_LIMIT),
        dirtyIds: new Set(state.dirtyIds).add(active.id),
        selectedItemId: null,
      };
    }
    case 'redo': {
      const active = state.diagrams.find((d) => d.id === state.activeDiagramId);
      if (!active || state.redo.length === 0) return state;
      const next = state.redo[state.redo.length - 1];
      return {
        ...state,
        diagrams: state.diagrams.map((d) => (d.id === active.id ? { ...d, scene: next } : d)),
        redo: state.redo.slice(0, -1),
        undo: [...state.undo, active.scene].slice(-UNDO_LIMIT),
        dirtyIds: new Set(state.dirtyIds).add(active.id),
        selectedItemId: null,
      };
    }
    case 'saved': {
      const diagrams = state.diagrams.map((d) => ({
        ...d,
        id: action.idMap[d.id] ?? d.id,
        persisted: true,
      }));
      return { ...state, diagrams, dirtyIds: new Set(), deletedIds: [], undo: [], redo: [] };
    }
  }
}

export function buildSaveOps(state: EditorState): DiagramSaveOps {
  return {
    creates: state.diagrams
      .filter((d) => !d.persisted)
      .map((d) => ({ tempId: d.id, title: d.title, order: d.order, scene: d.scene })),
    updates: state.diagrams
      .filter((d) => d.persisted && state.dirtyIds.has(d.id))
      .map((d) => ({ id: d.id, title: d.title, order: d.order, scene: d.scene })),
    deletes: state.deletedIds,
  };
}

export function useDiagramEditor(exerciseId: string, uid: string) {
  const [state, dispatch] = useReducer(diagramReducer, initialEditorState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listDiagrams(exerciseId)
      .then((docs) => {
        if (cancelled) return;
        dispatch({
          type: 'loaded',
          diagrams: docs.map((d) => ({
            id: d.id,
            persisted: true,
            title: d.title,
            order: d.order,
            scene: d.scene,
          })),
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load diagrams. Please refresh.');
      });
    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const save = useCallback(async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const ops = buildSaveOps(state);
      const { idMap } = await saveDiagramSet(exerciseId, ops, uid);
      dispatch({ type: 'saved', idMap });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save diagrams. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [state, exerciseId, uid]);

  const activeDiagram = state.diagrams.find((d) => d.id === state.activeDiagramId) ?? null;
  const dirty = state.dirtyIds.size > 0 || state.deletedIds.length > 0;

  return { state, activeDiagram, dispatch, save, saving, dirty, loadError, saveError };
}
