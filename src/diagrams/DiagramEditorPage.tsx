import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { DiagramSvg } from './DiagramSvg';
import { DiagramTabs } from './DiagramTabs';
import { Palette } from './Palette';
import { PropertiesPanel } from './PropertiesPanel';
import { CanvasStage } from './CanvasStage';
import { createItem } from './sceneFactory';
import { useDiagramEditor } from './useDiagramEditor';
import { SCENE_LIMITS, type DiagramItemType } from '../types/diagram';

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

  const handleStageReady = useCallback((api: { screenToCourt: (x: number, y: number) => { x: number; y: number } }) => {
    stageApi.current = api;
  }, []);

  // Autosave 3s after the last change.
  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(() => void save(), 3000);
    return () => window.clearTimeout(timer);
  }, [state, dirty, save]);

  // Save on unmount if still dirty.
  useEffect(() => () => {
    if (dirty) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === 'blocked' && window.confirm('You have unsaved diagram changes. Leave anyway?')) {
      blocker.proceed();
    } else if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }, [blocker]);

  const addFromPalette = useCallback(
    (type: DiagramItemType) => {
      const at = { x: 50, y: 50 };
      dispatch({ type: 'addItem', item: createItem(type, at) });
    },
    [dispatch],
  );

  const beginDrag = useCallback(
    (id: string, e: React.PointerEvent) => {
      dispatch({ type: 'selectItem', id });
      const startClient = { x: e.clientX, y: e.clientY };
      const item = activeDiagram?.scene.items.find((i) => i.id === id);
      if (!item) return;
      const origin = { x: item.x, y: item.y };
      const move = (ev: PointerEvent) => {
        const api = stageApi.current;
        if (!api) return;
        const a = api.screenToCourt(startClient.x, startClient.y);
        const b = api.screenToCourt(ev.clientX, ev.clientY);
        const nx = origin.x + (b.x - a.x);
        const ny = origin.y + (b.y - a.y);
        dispatch({ type: 'moveItem', id, x: snapOn ? snap(nx) : nx, y: snapOn ? snap(ny) : ny });
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [activeDiagram, dispatch, snapOn],
  );

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
        <button type="button" onClick={() => navigate('/exercises')} className="text-sm text-blue">‹ Exercises</button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate">
            <input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} /> Snap
          </label>
          {saveError && <span role="alert" className="text-xs text-red">{saveError}</span>}
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

          <div className="relative overflow-hidden">
            <CanvasStage onReady={handleStageReady}>
              <DiagramSvg
                scene={activeDiagram.scene}
                interactive
                selectedId={state.selectedItemId}
                onItemPointerDown={beginDrag}
                onBackgroundPointerDown={() => dispatch({ type: 'selectItem', id: null })}
              />
            </CanvasStage>
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
            <PropertiesPanel
              item={activeDiagram.scene.items.find((i) => i.id === state.selectedItemId) ?? null}
              dispatch={dispatch}
            />
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
