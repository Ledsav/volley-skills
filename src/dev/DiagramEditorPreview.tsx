import { useReducer } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DiagramEditorView } from '../diagrams/DiagramEditorView';
import { diagramReducer, initialEditorState, type EditorDiagram, type EditorState } from '../diagrams/useDiagramEditor';
import type { DiagramItem } from '../types/diagram';

// Dev-only page (/dev/preview/diagram-editor): the real editor UI over an in-memory scene with a no-op save,
// so the editor can be looked at and screenshotted without signing in. `?empty=1` starts with nothing selected;
// `?panel=add|edit|court` opens that phone panel.

const ITEMS: DiagramItem[] = [
  { id: 'p1', type: 'player', x: 30, y: 70, rotation: 0, size: 1, color: 'blue', label: 'OH', shape: 'circle', view: 'above' },
  { id: 'p2', type: 'player', x: 50, y: 78, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle', view: 'above' },
  { id: 'p3', type: 'player', x: 70, y: 70, rotation: 0, size: 1, color: 'navy', label: 'MB', shape: 'circle', view: 'token' },
  { id: 'b1', type: 'ball', x: 52, y: 62, rotation: 0, size: 1, color: 'orange', style: 'mikasa' },
  { id: 'c1', type: 'cone', x: 22, y: 30, rotation: 0, size: 1, color: 'orange' },
  {
    id: 'a1',
    type: 'arrow',
    x: 50,
    y: 78,
    rotation: 0,
    size: 1,
    color: 'ink',
    from: { x: 50, y: 76 },
    to: { x: 32, y: 66 },
    curved: true,
    style: 'pass',
    head: 'single',
  },
];

const DIAGRAMS: EditorDiagram[] = [
  { id: 'd1', persisted: true, title: 'Serve receive', order: 0, scene: { v: 1, court: 'full', showZones: false, items: ITEMS } },
  { id: 'd2', persisted: true, title: 'Transition', order: 1, scene: { v: 1, court: 'half', showZones: true, items: [] } },
];

function fixture(empty: boolean): EditorState {
  const loaded = diagramReducer(initialEditorState, { type: 'loaded', diagrams: DIAGRAMS });
  return empty ? loaded : diagramReducer(loaded, { type: 'selectItem', id: 'p1' });
}

export default function DiagramEditorPreview() {
  const [params] = useSearchParams();
  const [state, dispatch] = useReducer(diagramReducer, params.get('empty') === '1', fixture);
  const panel = params.get('panel');
  const activeDiagram = state.diagrams.find((d) => d.id === state.activeDiagramId) ?? null;
  return (
    <DiagramEditorView
      state={state}
      activeDiagram={activeDiagram}
      dispatch={dispatch}
      save={() => undefined}
      status="saved"
      saveError={null}
      onExit={() => undefined}
      initialPhonePanel={panel === 'add' || panel === 'edit' || panel === 'court' ? panel : undefined}
    />
  );
}
