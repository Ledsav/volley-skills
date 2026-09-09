import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { DiagramSvg } from './DiagramSvg';
import { DiagramTabs } from './DiagramTabs';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasStage } from './CanvasStage';
import { CanvasContextMenu, type MenuAction } from './CanvasContextMenu';
import { createItem, cloneItemAt } from './sceneFactory';
import { getDiagramClipboard, setDiagramClipboard } from './diagramClipboard';
import { computeHandleTransform } from './transformMath';
import { useDiagramEditor } from './useDiagramEditor';
import { SCENE_LIMITS, type CourtPreset, type DiagramItemType } from '../types/diagram';

const SNAP = 2.5;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

export function DiagramEditorPage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';
  const { state, activeDiagram, dispatch, save, saving, dirty, loadError, saveError } = useDiagramEditor(exerciseId, uid);
  const stageApi = useRef<{ screenToCourt: (x: number, y: number) => { x: number; y: number } } | null>(null);
  const [snapOn, setSnapOn] = useState(true);
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const handleStageReady = useCallback((api: { screenToCourt: (x: number, y: number) => { x: number; y: number } }) => {
    stageApi.current = api;
  }, []);

  // Autosave 3s after the last change.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 3000);
    return () => window.clearTimeout(timer);
  }, [state, dirty, save]);

  // Save on unmount if still dirty. Mirror `dirty`/`save` into refs each render
  // so the unmount cleanup reads the latest values, not the first-render closure
  // (where `dirty` is always false). This is the in-app-nav safety net.
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(save);
  useEffect(() => {
    dirtyRef.current = dirty;
    saveRef.current = save;
  });
  useEffect(
    () => () => {
      if (dirtyRef.current) void saveRef.current();
    },
    [],
  );

  // Undo / redo + clipboard keyboard shortcuts. Ignore while typing in a field
  // so title editing keeps its native Ctrl/Cmd+Z, Backspace, etc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const selectedId = state.selectedItemId;
      const items = activeDiagram?.scene.items ?? [];

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) {
          e.preventDefault();
          dispatch({ type: 'deleteItem', id: selectedId });
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (key === 'c') {
        const item = items.find((i) => i.id === selectedId);
        if (item) {
          e.preventDefault();
          setDiagramClipboard(item);
        }
      } else if (key === 'v') {
        const clip = getDiagramClipboard();
        if (clip) {
          e.preventDefault();
          dispatch({ type: 'addItem', item: cloneItemAt(clip, 2.5, 2.5) });
        }
      } else if (key === 'd') {
        const item = items.find((i) => i.id === selectedId);
        if (item) {
          e.preventDefault();
          dispatch({ type: 'addItem', item: cloneItemAt(item, 2.5, 2.5) });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.selectedItemId, activeDiagram]);

  // Warn on tab close while dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function leaveEditor() {
    if (dirty && !window.confirm('You have unsaved diagram changes. Leave anyway?')) return;
    navigate('/exercises');
  }

  const addFromPalette = useCallback(
    (type: DiagramItemType) => {
      const stage = document.querySelector('[data-canvas-stage]') as HTMLElement | null;
      let at = { x: 50, y: 50 };
      if (stage && stageApi.current) {
        const r = stage.getBoundingClientRect();
        at = stageApi.current.screenToCourt(r.left + r.width / 2, r.top + r.height / 2);
      }
      dispatch({ type: 'addItem', item: createItem(type, at) });
    },
    [dispatch],
  );

  const beginDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      dispatch({ type: 'selectItem', id });
      const api = stageApi.current;
      if (!api) return;
      // Translate by the delta since the previous move so line/arrow geometry
      // moves as a unit too (they have no single x/y to set absolutely).
      let last = api.screenToCourt(e.clientX, e.clientY);
      const move = (ev: PointerEvent) => {
        const cur = stageApi.current?.screenToCourt(ev.clientX, ev.clientY);
        if (!cur) return;
        let dx = cur.x - last.x;
        let dy = cur.y - last.y;
        if (snapOn) {
          dx = snap(dx);
          dy = snap(dy);
        }
        if (dx === 0 && dy === 0) return;
        dispatch({ type: 'translateItem', id, dx, dy });
        // Advance the reference by what we actually applied so sub-grid motion
        // accumulates until it crosses the next snap step.
        last = { x: last.x + dx, y: last.y + dy };
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, snapOn],
  );

  const beginEndpointDrag = useCallback(
    (id: string, index: number) => {
      dispatch({ type: 'selectItem', id });
      const api = stageApi.current;
      if (!api) return;
      // Endpoints are absolute court positions (a line/arrow has no single x/y),
      // so dispatch the snapped absolute pointer position each move.
      let last: { x: number; y: number } | null = null;
      const move = (ev: PointerEvent) => {
        const p = stageApi.current?.screenToCourt(ev.clientX, ev.clientY);
        if (!p) return;
        let x = p.x;
        let y = p.y;
        if (snapOn) {
          x = snap(x);
          y = snap(y);
        }
        if (last && last.x === x && last.y === y) return;
        last = { x, y };
        dispatch({ type: 'moveEndpoint', id, index, x, y });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, snapOn],
  );

  const beginTransform = useCallback(
    (id: string, e: React.PointerEvent) => {
      dispatch({ type: 'selectItem', id });
      const api = stageApi.current;
      if (!api) return;
      const item = activeDiagram?.scene.items.find((i) => i.id === id);
      if (!item) return;
      // Capture the drag origin once: the element centre, the pointer's court
      // position, and the item's size/rotation at grab time.
      const center = { x: item.x, y: item.y };
      const start = api.screenToCourt(e.clientX, e.clientY);
      const startSize = item.size;
      const startRotation = item.rotation;
      // Skip dispatches that wouldn't change anything: `transformItem` always
      // produces a fresh scene (so `mutateActive` can't short-circuit it), and
      // every push burns an undo frame. Mirrors `beginDrag`'s dx/dy===0 guard.
      let lastSize = startSize;
      let lastRotation = startRotation;
      const move = (ev: PointerEvent) => {
        const current = stageApi.current?.screenToCourt(ev.clientX, ev.clientY);
        if (!current) return;
        const { size, rotation } = computeHandleTransform({
          center,
          start,
          current,
          startSize,
          startRotation,
          snapRotation: snapOn,
        });
        if (size === lastSize && rotation === lastRotation) return;
        lastSize = size;
        lastRotation = rotation;
        dispatch({ type: 'transformItem', id, rotation, size });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, snapOn, activeDiagram],
  );

  const selectedItem =
    activeDiagram?.scene.items.find((i) => i.id === state.selectedItemId) ?? null;

  const menuActions: MenuAction[] = [
    {
      label: 'Copy',
      disabled: !selectedItem,
      onSelect: () => {
        if (selectedItem) setDiagramClipboard(selectedItem);
      },
    },
    {
      label: 'Paste',
      disabled: !getDiagramClipboard(),
      onSelect: () => {
        const clip = getDiagramClipboard();
        if (clip) dispatch({ type: 'addItem', item: cloneItemAt(clip, 2.5, 2.5) });
      },
    },
    {
      label: 'Duplicate',
      disabled: !selectedItem,
      onSelect: () => {
        if (selectedItem) dispatch({ type: 'addItem', item: cloneItemAt(selectedItem, 2.5, 2.5) });
      },
    },
    {
      label: 'Delete',
      disabled: !selectedItem,
      onSelect: () => {
        if (state.selectedItemId) dispatch({ type: 'deleteItem', id: state.selectedItemId });
      },
    },
    {
      label: 'Bring forward',
      disabled: !selectedItem,
      onSelect: () => {
        if (state.selectedItemId)
          dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'forward' });
      },
    },
    {
      label: 'Send backward',
      disabled: !selectedItem,
      onSelect: () => {
        if (state.selectedItemId)
          dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'backward' });
      },
    },
  ];

  if (loadError) {
    return (
      <div className="p-6">
        <p role="alert" className="text-red">{loadError}</p>
        <Link to="/exercises" className="mt-3 inline-block text-blue underline">Back to exercises</Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col bg-bg">
      <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
        <button type="button" onClick={leaveEditor} className="text-sm text-blue">‹ Exercises</button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate">
            <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Snap
          </label>
          {activeDiagram && (
            <>
              <label className="flex items-center gap-1 text-xs text-slate">
                Court
                <select
                  aria-label="Court preset"
                  value={activeDiagram.scene.court}
                  onChange={(e) => dispatch({ type: 'setCourt', court: e.target.value as CourtPreset })}
                  className="rounded-md border border-border bg-surface px-2 py-1 text-ink"
                >
                  <option value="full">Full</option>
                  <option value="half">Half</option>
                  <option value="blank">Blank</option>
                </select>
              </label>
              <label className="flex items-center gap-1 text-xs text-slate">
                <input
                  type="checkbox"
                  checked={activeDiagram.scene.showZones}
                  onChange={() => dispatch({ type: 'toggleZones' })}
                />
                Zones
              </label>
            </>
          )}
          {saveError && <span role="alert" className="text-xs text-red">{saveError}</span>}
          <Button
            variant="secondary"
            size="sm"
            disabled={state.undo.length === 0}
            onClick={() => dispatch({ type: 'undo' })}
          >
            Undo
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={state.redo.length === 0}
            onClick={() => dispatch({ type: 'redo' })}
          >
            Redo
          </Button>
          <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <DiagramTabs
        diagrams={state.diagrams}
        activeId={state.activeDiagramId}
        dirtyIds={state.dirtyIds}
        canAdd={state.diagrams.length < SCENE_LIMITS.diagramsPerExercise}
        dispatch={dispatch}
      />

      {activeDiagram ? (
        <div className="grid flex-1 grid-rows-[1fr_auto] overflow-hidden lg:grid-cols-[160px_1fr_260px] lg:grid-rows-1">
          <aside className="hidden border-r border-border bg-surface p-2 lg:block">
            <Palette onAdd={addFromPalette} variant="rail" />
          </aside>

          <div
            className="relative overflow-hidden"
            onContextMenu={(e) => {
              e.preventDefault();
              const id = (e.target as Element).closest('[data-item-id]')?.getAttribute('data-item-id');
              if (id) dispatch({ type: 'selectItem', id });
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <CanvasStage onReady={handleStageReady}>
              <DiagramSvg
                scene={activeDiagram.scene}
                interactive
                selectedId={state.selectedItemId}
                onItemPointerDown={beginDrag}
                onTransformHandlePointerDown={beginTransform}
                onEndpointPointerDown={beginEndpointDrag}
                onBackgroundPointerDown={() => dispatch({ type: 'selectItem', id: null })}
              />
            </CanvasStage>
            {menu && (
              <CanvasContextMenu
                x={menu.x}
                y={menu.y}
                actions={menuActions}
                onClose={() => setMenu(null)}
              />
            )}
          </div>

          <aside className="border-t border-border bg-surface lg:border-l lg:border-t-0">
            <div className="lg:hidden">
              <button
                type="button"
                aria-expanded={mobilePaletteOpen}
                onClick={() => setMobilePaletteOpen((v) => !v)}
                className="w-full border-b border-border px-3 py-2 text-left text-sm font-medium text-ink"
              >
                {mobilePaletteOpen ? 'Hide elements' : 'Elements'}
              </button>
              {mobilePaletteOpen && (
                <div className="p-2">
                  <Palette onAdd={addFromPalette} variant="grid" />
                </div>
              )}
            </div>
            <PropertiesPanel item={selectedItem} dispatch={dispatch} />
          </aside>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate">
          <p>No diagrams yet.</p>
          <Button variant="primary" size="sm" onClick={() => dispatch({ type: 'addDiagram' })}>Add the first diagram</Button>
        </div>
      )}
    </div>
  );
}
