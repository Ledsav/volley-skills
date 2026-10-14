import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowUpToLine,
  BoxSelect,
  ChevronLeft,
  Copy,
  Maximize,
  Plus,
  Redo2,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useMediaQuery } from '../components/useMediaQuery';
import { SCENE_LIMITS, type CourtPreset, type DiagramItemType } from '../types/diagram';
import { CanvasContextMenu, type MenuAction } from './CanvasContextMenu';
import { CanvasStage, type StageApi } from './CanvasStage';
import { getDiagramClipboard, setDiagramClipboard } from './diagramClipboard';
import { DiagramSvg, bbox } from './DiagramSvg';
import { DiagramTabs } from './DiagramTabs';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { cloneItemAt, createItem } from './sceneFactory';
import { computeHandleTransform } from './transformMath';
import { useDiagramEditor } from './useDiagramEditor';

const SNAP = 2.5;

const toolBtn =
  'inline-flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-2 text-[11px] font-medium text-ink hover:bg-bg disabled:opacity-40 aria-pressed:bg-blue/10 aria-pressed:text-blue';
const zoomBtn =
  'inline-flex h-10 w-10 items-center justify-center text-slate hover:bg-bg hover:text-ink';

/** Non-modal panel pinned to the bottom of the canvas on phones — the court
 *  stays visible (and editable) above it so changes show up live. */
function BottomPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[55%] flex-col rounded-t-lg border-t border-border bg-surface shadow-pop"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <button
          type="button"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg hover:text-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </section>
  );
}
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

type Rect = { x: number; y: number; w: number; h: number };

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function DiagramEditorPage() {
  const { exerciseId = '' } = useParams();
  const navigate = useNavigate();
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? '';
  const { state, activeDiagram, dispatch, save, saving, dirty, loadError, saveError } = useDiagramEditor(exerciseId, uid);
  const stageApi = useRef<StageApi | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [snapOn, setSnapOn] = useState(true);
  // Phone-only UI: which bottom panel is open, the settings drop-down, and a
  // sticky multi-select mode (touch has no Shift/Ctrl to add to a selection).
  const [mobilePanel, setMobilePanel] = useState<'add' | 'edit' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [multiSelect, setMultiSelect] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);

  const handleStageReady = useCallback((api: StageApi) => {
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

      const selectedIds = state.selectedIds;
      const items = activeDiagram?.scene.items ?? [];
      const selected = items.filter((i) => selectedIds.includes(i.id));

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length) {
          e.preventDefault();
          dispatch({ type: 'deleteSelected' });
        }
        return;
      }

      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        dispatch({ type: 'selectAll' });
      } else if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      } else if (key === 'c') {
        if (selected.length) {
          e.preventDefault();
          setDiagramClipboard(selected);
        }
      } else if (key === 'v') {
        const clip = getDiagramClipboard();
        if (clip.length) {
          e.preventDefault();
          dispatch({ type: 'pasteItems', items: clip.map((it) => cloneItemAt(it, 2.5, 2.5)) });
        }
      } else if (key === 'd') {
        if (selected.length) {
          e.preventDefault();
          dispatch({ type: 'pasteItems', items: selected.map((it) => cloneItemAt(it, 2.5, 2.5)) });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.selectedIds, activeDiagram]);

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

  const [confirmLeave, setConfirmLeave] = useState(false);

  function leaveEditor() {
    if (dirty) setConfirmLeave(true);
    else navigate('/exercises');
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
      // On a phone, close the picker so the new (selected) element is visible.
      setMobilePanel(null);
    },
    [dispatch],
  );

  // Drag the whole current selection as a unit. The caller decides selection
  // (replace vs. toggle) before starting the drag.
  const beginDrag = useCallback(
    (e: React.PointerEvent) => {
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
        dispatch({ type: 'translateSelected', dx, dy });
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

  // Shift+drag on empty canvas draws a rubber-band box; items whose bbox
  // intersects it on release are ADDED to the selection (Shift already means
  // "additive" for item clicks). A plain drag on empty canvas still pans.
  const beginMarquee = useCallback(
    (e: React.PointerEvent) => {
      const api = stageApi.current;
      if (!api) return;
      const start = api.screenToCourt(e.clientX, e.clientY);
      setMarqueeRect({ x: start.x, y: start.y, w: 0, h: 0 });
      const move = (ev: PointerEvent) => {
        const cur = stageApi.current?.screenToCourt(ev.clientX, ev.clientY);
        if (!cur) return;
        setMarqueeRect({
          x: Math.min(start.x, cur.x),
          y: Math.min(start.y, cur.y),
          w: Math.abs(cur.x - start.x),
          h: Math.abs(cur.y - start.y),
        });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setMarqueeRect((rect) => {
          if (rect) {
            const hits = (activeDiagram?.scene.items ?? []).filter((it) => intersects(bbox(it), rect));
            if (hits.length) dispatch({ type: 'addToSelection', ids: hits.map((it) => it.id) });
          }
          return null;
        });
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, activeDiagram],
  );

  const onItemPointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      const additive = multiSelect || e.shiftKey || e.metaKey || e.ctrlKey;
      if (additive) {
        // Modifier-click toggles membership and does NOT start a drag.
        dispatch({ type: 'toggleSelect', id });
        return;
      }
      if (!state.selectedIds.includes(id)) {
        // Plain click on an unselected item selects just it; a plain click on
        // an already-selected item keeps the whole selection so it can be dragged.
        dispatch({ type: 'selectItem', id });
      }
      beginDrag(e);
    },
    [dispatch, state.selectedIds, beginDrag, multiSelect],
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
  const selectedItems =
    activeDiagram?.scene.items.filter((i) => state.selectedIds.includes(i.id)) ?? [];
  const selectedCount = state.selectedIds.length;
  // Deselecting (tap on empty court) closes the phone's edit panel, so it
  // doesn't pop back open on the next selection.
  useEffect(() => {
    if (selectedCount === 0) setMobilePanel((p) => (p === 'edit' ? null : p));
  }, [selectedCount]);
  const suffix = selectedCount > 1 ? ` (${selectedCount})` : '';

  const menuActions: MenuAction[] = [
    {
      label: `Copy${suffix}`,
      disabled: selectedCount < 1,
      onSelect: () => {
        if (selectedItems.length) setDiagramClipboard(selectedItems);
      },
    },
    {
      label: 'Paste',
      disabled: getDiagramClipboard().length === 0,
      onSelect: () => {
        const clip = getDiagramClipboard();
        if (clip.length)
          dispatch({ type: 'pasteItems', items: clip.map((it) => cloneItemAt(it, 2.5, 2.5)) });
      },
    },
    {
      label: `Duplicate${suffix}`,
      disabled: selectedCount < 1,
      onSelect: () => {
        if (selectedItems.length)
          dispatch({
            type: 'pasteItems',
            items: selectedItems.map((it) => cloneItemAt(it, 2.5, 2.5)),
          });
      },
    },
    {
      label: `Delete${suffix}`,
      disabled: selectedCount < 1,
      onSelect: () => {
        if (selectedCount) dispatch({ type: 'deleteSelected' });
      },
    },
    {
      label: 'Bring forward',
      disabled: selectedCount !== 1,
      onSelect: () => {
        if (state.selectedItemId)
          dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'forward' });
      },
    },
    {
      label: 'Send backward',
      disabled: selectedCount !== 1,
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

  const courtSettings = activeDiagram && (
    <>
      <label className="flex items-center gap-2 text-sm text-slate lg:gap-1 lg:text-xs">
        <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Snap
      </label>
      <label className="flex items-center gap-2 text-sm text-slate lg:gap-1 lg:text-xs">
        Court
        <select
          aria-label="Court preset"
          value={activeDiagram.scene.court}
          onChange={(e) => dispatch({ type: 'setCourt', court: e.target.value as CourtPreset })}
          className="min-h-11 rounded-md border border-border bg-surface px-2 py-1 text-ink lg:min-h-0"
        >
          <option value="full">Full</option>
          <option value="half">Half</option>
          <option value="blank">Blank</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm text-slate lg:gap-1 lg:text-xs">
        <input
          type="checkbox"
          checked={activeDiagram.scene.showZones}
          onChange={() => dispatch({ type: 'toggleZones' })}
        />
        Zones
      </label>
    </>
  );

  return (
    // Phones: a full-screen layer over the app's bottom tab bar, so the court
    // gets all the room. Desktop: a normal page inside the shell.
    <div className="fixed inset-0 z-40 flex flex-col bg-bg lg:static lg:z-auto lg:h-screen">
      {isDesktop ? (
        <header className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-2">
          <button type="button" onClick={leaveEditor} className="text-sm text-blue">‹ Exercises</button>
          <div className="flex items-center gap-3">
            {courtSettings}
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
      ) : (
        <header className="relative border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              onClick={leaveEditor}
              aria-label="Back to exercises"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-blue hover:bg-bg"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm text-slate">
              {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <button
              type="button"
              aria-label="Undo"
              disabled={state.undo.length === 0}
              onClick={() => dispatch({ type: 'undo' })}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-bg disabled:opacity-30"
            >
              <Undo2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Redo"
              disabled={state.redo.length === 0}
              onClick={() => dispatch({ type: 'redo' })}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-bg disabled:opacity-30"
            >
              <Redo2 className="h-5 w-5" aria-hidden="true" />
            </button>
            {activeDiagram && (
              <button
                type="button"
                aria-label="Court settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((v) => !v)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink hover:bg-bg aria-expanded:bg-blue/10 aria-expanded:text-blue"
              >
                <Settings2 className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
            <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
          {saveError && (
            <p role="alert" className="px-3 pb-2 text-xs text-red">
              {saveError}
            </p>
          )}
          {settingsOpen && courtSettings && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-2">
              {courtSettings}
            </div>
          )}
        </header>
      )}

      <DiagramTabs
        diagrams={state.diagrams}
        activeId={state.activeDiagramId}
        dirtyIds={state.dirtyIds}
        canAdd={state.diagrams.length < SCENE_LIMITS.diagramsPerExercise}
        dispatch={dispatch}
      />

      {activeDiagram ? (
        <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[160px_1fr_260px] lg:overflow-hidden">
          {isDesktop && (
            <aside className="border-r border-border bg-surface p-2">
              <Palette onAdd={addFromPalette} variant="rail" />
            </aside>
          )}

          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            onContextMenu={(e) => {
              e.preventDefault();
              const id = (e.target as Element).closest('[data-item-id]')?.getAttribute('data-item-id');
              // Right-clicking outside the current selection selects just that
              // item; right-clicking within a multi-selection keeps it.
              if (id && !state.selectedIds.includes(id)) dispatch({ type: 'selectItem', id });
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <CanvasStage onReady={handleStageReady}>
              <DiagramSvg
                scene={activeDiagram.scene}
                interactive
                selectedIds={state.selectedIds}
                marqueeRect={marqueeRect}
                onItemPointerDown={onItemPointerDown}
                onTransformHandlePointerDown={beginTransform}
                onEndpointPointerDown={beginEndpointDrag}
                onBackgroundPointerDown={(e) => {
                  if (e.shiftKey) {
                    beginMarquee(e);
                    return;
                  }
                  dispatch({ type: 'selectItem', id: null });
                }}
              />
            </CanvasStage>

            <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-md border border-border bg-surface shadow-card">
              <button type="button" aria-label="Zoom in" onClick={() => stageApi.current?.zoomBy(1.25)} className={zoomBtn}>
                <ZoomIn className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Zoom out" onClick={() => stageApi.current?.zoomBy(0.8)} className={`${zoomBtn} border-t border-border`}>
                <ZoomOut className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Fit court" onClick={() => stageApi.current?.resetView()} className={`${zoomBtn} border-t border-border`}>
                <Maximize className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {!isDesktop && mobilePanel === 'add' && (
              <BottomPanel title="Add element" onClose={() => setMobilePanel(null)}>
                <div className="p-3">
                  <Palette onAdd={addFromPalette} variant="grid" />
                </div>
              </BottomPanel>
            )}
            {!isDesktop && mobilePanel === 'edit' && selectedCount > 0 && (
              <BottomPanel
                title={selectedCount > 1 ? `${selectedCount} elements` : 'Edit element'}
                onClose={() => setMobilePanel(null)}
              >
                <PropertiesPanel item={selectedItem} dispatch={dispatch} selectedCount={selectedCount} />
              </BottomPanel>
            )}

            {menu && (
              <CanvasContextMenu
                x={menu.x}
                y={menu.y}
                actions={menuActions}
                onClose={() => setMenu(null)}
              />
            )}
          </div>

          {isDesktop ? (
            <aside className="border-l border-border bg-surface">
              <PropertiesPanel
                item={selectedItem}
                dispatch={dispatch}
                selectedCount={selectedCount}
              />
            </aside>
          ) : (
            <nav
              aria-label="Diagram tools"
              className="flex shrink-0 items-center justify-around gap-1 border-t border-border bg-surface px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1"
            >
              <button
                type="button"
                aria-pressed={mobilePanel === 'add'}
                onClick={() => setMobilePanel((p) => (p === 'add' ? null : 'add'))}
                className={toolBtn}
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
                Add
              </button>
              <button
                type="button"
                aria-pressed={multiSelect}
                onClick={() => setMultiSelect((v) => !v)}
                className={toolBtn}
              >
                <BoxSelect className="h-5 w-5" aria-hidden="true" />
                Multi
              </button>
              <button
                type="button"
                aria-pressed={mobilePanel === 'edit'}
                disabled={selectedCount === 0}
                onClick={() => setMobilePanel((p) => (p === 'edit' ? null : 'edit'))}
                className={toolBtn}
              >
                <SlidersHorizontal className="h-5 w-5" aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() =>
                  dispatch({ type: 'pasteItems', items: selectedItems.map((it) => cloneItemAt(it, 2.5, 2.5)) })
                }
                className={toolBtn}
              >
                <Copy className="h-5 w-5" aria-hidden="true" />
                Duplicate
              </button>
              <button
                type="button"
                disabled={selectedCount !== 1}
                onClick={() => {
                  if (state.selectedItemId) dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'forward' });
                }}
                className={toolBtn}
              >
                <ArrowUpToLine className="h-5 w-5" aria-hidden="true" />
                Forward
              </button>
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  dispatch({ type: 'deleteSelected' });
                  setMobilePanel(null);
                }}
                className={`${toolBtn} text-red`}
              >
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                Delete
              </button>
            </nav>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate">
          <p>No diagrams yet.</p>
          <Button variant="primary" size="sm" onClick={() => dispatch({ type: 'addDiagram' })}>Add the first diagram</Button>
        </div>
      )}
      {confirmLeave && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved diagram changes."
          confirmLabel="Leave"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={() => navigate('/exercises')}
        />
      )}
    </div>
  );
}
