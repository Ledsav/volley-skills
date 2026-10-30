import { useCallback, useEffect, useRef, useState, type Dispatch, type ReactNode } from 'react';
import {
  BoxSelect,
  BringToFront,
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
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useMediaQuery } from '../components/useMediaQuery';
import { SCENE_LIMITS, type DiagramItemType, type Scene } from '../types/diagram';
import { CanvasContextMenu, type MenuAction } from './CanvasContextMenu';
import { CanvasStage, type StageApi, type StageInsets } from './CanvasStage';
import { getDiagramClipboard, setDiagramClipboard } from './diagramClipboard';
import { DiagramSvg, bbox } from './DiagramSvg';
import { courtBox } from './courtGeometry';
import { DiagramTabs } from './DiagramTabs';
import { Palette } from './Palette';
import { CourtSection, PropertiesPanel } from './PropertiesPanel';
import { SaveStatus } from './SaveStatus';
import { cloneItemAt, createItem } from './sceneFactory';
import { computeHandleTransform } from './transformMath';
import type { EditorAction, EditorDiagram, EditorSaveStatus, EditorState } from './useDiagramEditor';
import { useT } from '../i18n/I18nProvider';
import { DiagramTip } from '../onboarding/DiagramTip';

const SNAP = 2.5;

// Desktop chrome geometry, in px. The toolbar floats 12 px from the edges; the tabs strip and the inspector start
// 12 px under it; the zoom pad sits bottom-left. The court is fitted into what is left between them.
const EDGE = 12;
const TOOLBAR_H = 60;
const BELOW_TOOLBAR = EDGE + TOOLBAR_H + EDGE;
const TABS_H = 52;
const INSPECTOR_W = 312;
const ZOOM_W = 44;
const DESKTOP_INSETS: StageInsets = {
  top: BELOW_TOOLBAR + TABS_H + 16,
  right: EDGE + INSPECTOR_W + 24,
  bottom: 24,
  left: EDGE + ZOOM_W + 24,
};

/** Room kept around the court when it is framed at rest, in grid units (players and labels just outside the lines). */
const FRAME_PAD = 5;
/** What the editor frames at rest: the court's outline plus a margin, so a half court sits in the middle too. */
function stageFrame(court: Scene['court']) {
  const b = courtBox(court);
  return { x: b.x - FRAME_PAD, y: b.y - FRAME_PAD, w: b.w + 2 * FRAME_PAD, h: b.h + 2 * FRAME_PAD };
}

const ICON = 'h-5 w-5';
const toolBtn =
  'pressable inline-flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-md px-1.5 text-caption text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40 aria-pressed:bg-surface-3';
const zoomBtn =
  'inline-flex h-11 w-11 items-center justify-center text-ink-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';
const iconBtn =
  'pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-30 disabled:hover:bg-transparent';
/** One internal vertical scroll with a quiet scrollbar, never a horizontal one. */
const panelScroll = 'scroll-quiet min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain';

/** Non-modal panel pinned to the bottom of the canvas on phones — the court
 *  stays visible (and editable) above it so changes show up live. */
function BottomPanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const t = useT().diagrams.editor;
  return (
    <section
      aria-label={title}
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[60%] flex-col rounded-t-xl bg-surface shadow-sheet"
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-ink-3/40" />
      <header className="flex shrink-0 items-center justify-between pl-4 pr-2">
        <h2 className="text-headline text-ink">{title}</h2>
        <button type="button" aria-label={t.closePanel(title)} onClick={onClose} className={iconBtn}>
          <X className={ICON} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>
      <div className={panelScroll}>{children}</div>
    </section>
  );
}
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

type Rect = { x: number; y: number; w: number; h: number };

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export interface DiagramEditorViewProps {
  state: EditorState;
  activeDiagram: EditorDiagram | null;
  dispatch: Dispatch<EditorAction>;
  /** Saves now (the Retry button). */
  save: () => unknown;
  status: EditorSaveStatus;
  saveError: string | null;
  /** Leaves the editor (back to the exercises list). */
  onExit: () => void;
  /** Phone only: a panel open from the start (the dev preview uses it to show each panel). */
  initialPhonePanel?: 'add' | 'edit' | 'court';
}

/** The editor's UI over an editor state: the page feeds it the real hook, the dev preview a fixture. */
export function DiagramEditorView({ state, activeDiagram, dispatch, save, status, saveError, onExit, initialPhonePanel }: DiagramEditorViewProps) {
  const t = useT();
  const ed = t.diagrams.editor;
  const stageApi = useRef<StageApi | null>(null);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [snapOn, setSnapOn] = useState(true);
  // Phone-only UI: which bottom panel is open, the settings drop-down, and a
  // sticky multi-select mode (touch has no Shift/Ctrl to add to a selection).
  const [mobilePanel, setMobilePanel] = useState<'add' | 'edit' | null>(
    initialPhonePanel === 'add' || initialPhonePanel === 'edit' ? initialPhonePanel : null,
  );
  const [settingsOpen, setSettingsOpen] = useState(initialPhonePanel === 'court');
  const [multiSelect, setMultiSelect] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<Rect | null>(null);

  const totalItems = state.diagrams.reduce((sum, d) => sum + d.scene.items.length, 0);

  const handleStageReady = useCallback((api: StageApi) => {
    stageApi.current = api;
  }, []);

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

  const [confirmLeave, setConfirmLeave] = useState(false);

  // The hook saves on unmount and on page hide, so leaving never needs to ask
  // unless a save is failing.
  function leaveEditor() {
    if (status === 'failed') setConfirmLeave(true);
    else onExit();
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
      label: `${t.diagrams.menu.copy}${suffix}`,
      disabled: selectedCount < 1,
      onSelect: () => {
        if (selectedItems.length) setDiagramClipboard(selectedItems);
      },
    },
    {
      label: t.diagrams.menu.paste,
      disabled: getDiagramClipboard().length === 0,
      onSelect: () => {
        const clip = getDiagramClipboard();
        if (clip.length)
          dispatch({ type: 'pasteItems', items: clip.map((it) => cloneItemAt(it, 2.5, 2.5)) });
      },
    },
    {
      label: `${t.diagrams.menu.duplicate}${suffix}`,
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
      label: `${t.diagrams.menu.delete}${suffix}`,
      disabled: selectedCount < 1,
      destructive: true,
      onSelect: () => {
        if (selectedCount) dispatch({ type: 'deleteSelected' });
      },
    },
    {
      label: t.diagrams.menu.bringForward,
      disabled: selectedCount !== 1,
      onSelect: () => {
        if (state.selectedItemId)
          dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'forward' });
      },
    },
    {
      label: t.diagrams.menu.sendBackward,
      disabled: selectedCount !== 1,
      onSelect: () => {
        if (state.selectedItemId)
          dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'backward' });
      },
    },
  ];

  const undoRedo = (
    <>
      <button type="button" aria-label={ed.undo} disabled={state.undo.length === 0} onClick={() => dispatch({ type: 'undo' })} className={iconBtn}>
        <Undo2 className={ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" aria-label={ed.redo} disabled={state.redo.length === 0} onClick={() => dispatch({ type: 'redo' })} className={iconBtn}>
        <Redo2 className={ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </>
  );

  const zoomGroup = (
    <>
      <button type="button" aria-label={ed.zoomIn} onClick={() => stageApi.current?.zoomBy(1.25)} className={zoomBtn}>
        <ZoomIn className={ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" aria-label={ed.zoomOut} onClick={() => stageApi.current?.zoomBy(0.8)} className={zoomBtn}>
        <ZoomOut className={ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" aria-label={ed.fitCourt} onClick={() => stageApi.current?.resetView()} className={zoomBtn}>
        <Maximize className={ICON} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </>
  );

  const tabs = (
    <DiagramTabs
      diagrams={state.diagrams}
      activeId={state.activeDiagramId}
      dirtyIds={state.dirtyIds}
      canAdd={state.diagrams.length < SCENE_LIMITS.diagramsPerExercise}
      dispatch={dispatch}
    />
  );

  const canvas = activeDiagram && (
    <div
      className={isDesktop ? 'absolute inset-0 overflow-hidden' : 'relative min-h-0 flex-1 overflow-hidden'}
      onPointerDown={(e) => {
        // The court is fitted inside insets; a press on the bare stage around it clears the selection like a
        // press on the court's own background does.
        const el = e.target as Element;
        if (!e.shiftKey && el.closest('[data-canvas-stage]') && !el.closest('svg')) dispatch({ type: 'selectItem', id: null });
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const id = (e.target as Element).closest('[data-item-id]')?.getAttribute('data-item-id');
        // Right-clicking outside the current selection selects just that
        // item; right-clicking within a multi-selection keeps it.
        if (id && !state.selectedIds.includes(id)) dispatch({ type: 'selectItem', id });
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <CanvasStage
        onReady={handleStageReady}
        insets={isDesktop ? DESKTOP_INSETS : undefined}
        fitBox={stageFrame(activeDiagram.scene.court)}
      >
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

      {!isDesktop && (
        <div className="glass glass-pop absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg">{zoomGroup}</div>
      )}

      {!isDesktop && mobilePanel === 'add' && (
        <BottomPanel title={ed.addElement} onClose={() => setMobilePanel(null)}>
          <div className="px-4 pb-4 pt-1">
            <Palette onAdd={addFromPalette} variant="grid" />
          </div>
        </BottomPanel>
      )}
      {!isDesktop && mobilePanel === 'edit' && selectedCount > 0 && (
        <BottomPanel
          title={selectedCount > 1 ? ed.elements(selectedCount) : ed.editElement}
          onClose={() => setMobilePanel(null)}
        >
          <PropertiesPanel item={selectedItem} dispatch={dispatch} selectedCount={selectedCount} />
        </BottomPanel>
      )}

      {menu && <CanvasContextMenu x={menu.x} y={menu.y} actions={menuActions} onClose={() => setMenu(null)} />}
    </div>
  );

  const emptyState = (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-2 lg:absolute lg:inset-0">
      <p>{ed.noDiagrams}</p>
      <Button variant="primary" size="sm" onClick={() => dispatch({ type: 'addDiagram' })}>{ed.addFirst}</Button>
    </div>
  );

  const backControl = (
    <button
      type="button"
      onClick={leaveEditor}
      aria-label={ed.backToExercises}
      className="pressable inline-flex h-11 shrink-0 items-center gap-0.5 rounded-md pl-1 pr-2 text-ink hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <ChevronLeft className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      {isDesktop && <span className="text-callout font-medium">{ed.exercisesLink}</span>}
    </button>
  );

  const divider = <span aria-hidden="true" className="mx-1 h-7 w-px shrink-0 bg-separator" />;

  return (
    // Full screen outside the app shell. data-own-undo: the editor owns Ctrl+Z.
    <div data-own-undo className="fixed inset-0 flex flex-col bg-bg">
      {isDesktop ? (
        <>
          {canvas}
          {!activeDiagram && emptyState}
          <header
            style={{ top: EDGE, height: TOOLBAR_H }}
            className="glass glass-pop absolute inset-x-3 z-20 flex items-center gap-1 rounded-xl px-2"
          >
            {backControl}
            <span className="flex w-[88px] shrink-0 items-center">
              <SaveStatus status={status} onRetry={() => void save()} />
            </span>
            {divider}
            <Palette onAdd={addFromPalette} variant="toolbar" />
            {divider}
            {undoRedo}
          </header>
          <div
            style={{ top: BELOW_TOOLBAR, maxWidth: `calc(100% - ${EDGE * 3 + INSPECTOR_W}px)` }}
            className="glass glass-pop absolute left-3 z-10 rounded-lg"
          >
            {tabs}
          </div>
          {activeDiagram && (
            <div
              style={{ top: BELOW_TOOLBAR + TABS_H + 4, left: EDGE + ZOOM_W + 24, width: 340 }}
              className="absolute z-10"
            >
              <DiagramTip itemCount={totalItems} className="mb-0 shadow-card" />
            </div>
          )}
          {activeDiagram && (
            <aside
              aria-label={ed.properties}
              style={{ top: BELOW_TOOLBAR, width: INSPECTOR_W, maxHeight: `calc(100% - ${BELOW_TOOLBAR + EDGE}px)` }}
              className="glass glass-pop absolute right-3 z-10 flex flex-col overflow-hidden rounded-xl"
            >
              <div className={panelScroll}>
                <CourtSection
                  title={ed.court}
                  scene={activeDiagram.scene}
                  dispatch={dispatch}
                  snapOn={snapOn}
                  onSnapChange={setSnapOn}
                />
                <PropertiesPanel item={selectedItem} dispatch={dispatch} selectedCount={selectedCount} />
              </div>
            </aside>
          )}
          {activeDiagram && (
            <div className="glass glass-pop absolute bottom-3 left-3 z-10 flex flex-col overflow-hidden rounded-lg">{zoomGroup}</div>
          )}
          {saveError && (
            <div
              style={{ left: DESKTOP_INSETS.left, right: DESKTOP_INSETS.right }}
              className="pointer-events-none absolute bottom-3 z-10 flex justify-center"
            >
              <p
                role="alert"
                title={saveError}
                className="glass glass-pop pointer-events-auto max-w-full truncate rounded-full px-4 py-2 text-footnote text-red-strong"
              >
                {saveError}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <header className="glass relative z-10 pt-[env(safe-area-inset-top)]">
            <div className="flex items-center gap-1 px-1 py-1">
              {backControl}
              <span className="flex min-w-0 flex-1 items-center">
                <SaveStatus status={status} onRetry={() => void save()} />
              </span>
              {undoRedo}
              {activeDiagram && (
                <button
                  type="button"
                  aria-label={ed.courtSettings}
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={`${iconBtn} aria-expanded:bg-surface-3 aria-expanded:text-ink`}
                >
                  <Settings2 className={ICON} strokeWidth={1.75} aria-hidden="true" />
                </button>
              )}
            </div>
            {saveError && (
              <p role="alert" className="px-4 pb-2 text-footnote text-red-strong">
                {saveError}
              </p>
            )}
            {settingsOpen && activeDiagram && (
              <div className="border-t border-separator">
                <CourtSection scene={activeDiagram.scene} dispatch={dispatch} snapOn={snapOn} onSnapChange={setSnapOn} />
              </div>
            )}
          </header>
          {tabs}
          {activeDiagram ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 px-3 pt-2 empty:hidden">
                <DiagramTip itemCount={totalItems} className="mb-2" />
              </div>
              {canvas}
              <nav
                aria-label={ed.toolsNav}
                className="glass flex shrink-0 items-center justify-around gap-0.5 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1"
              >
                <button type="button" aria-pressed={mobilePanel === 'add'} onClick={() => setMobilePanel((p) => (p === 'add' ? null : 'add'))} className={toolBtn}>
                  <Plus className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{ed.add}</span>
                </button>
                <button type="button" aria-pressed={multiSelect} onClick={() => setMultiSelect((v) => !v)} className={toolBtn}>
                  <BoxSelect className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{ed.multi}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={mobilePanel === 'edit'}
                  disabled={selectedCount === 0}
                  onClick={() => setMobilePanel((p) => (p === 'edit' ? null : 'edit'))}
                  className={toolBtn}
                >
                  <SlidersHorizontal className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{ed.edit}</span>
                </button>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() =>
                    dispatch({ type: 'pasteItems', items: selectedItems.map((it) => cloneItemAt(it, 2.5, 2.5)) })
                  }
                  className={toolBtn}
                >
                  <Copy className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{ed.duplicate}</span>
                </button>
                <button
                  type="button"
                  disabled={selectedCount !== 1}
                  onClick={() => {
                    if (state.selectedItemId) dispatch({ type: 'reorderItem', id: state.selectedItemId, to: 'forward' });
                  }}
                  className={toolBtn}
                >
                  <BringToFront className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{ed.forward}</span>
                </button>
                <button
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() => {
                    dispatch({ type: 'deleteSelected' });
                    setMobilePanel(null);
                  }}
                  className={`${toolBtn} text-red-strong`}
                >
                  <Trash2 className={ICON} strokeWidth={1.75} aria-hidden="true" />
                  <span>{t.common.delete}</span>
                </button>
              </nav>
            </div>
          ) : (
            emptyState
          )}
        </>
      )}
      {confirmLeave && (
        <ConfirmDialog
          title={ed.leaveFailingTitle}
          message={ed.leaveFailingMessage}
          confirmLabel={ed.leave}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={onExit}
        />
      )}
    </div>
  );
}
