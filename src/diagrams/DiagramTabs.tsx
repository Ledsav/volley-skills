import type { Dispatch } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { SCENE_LIMITS } from '../types/diagram';
import type { EditorAction, EditorDiagram } from './useDiagramEditor';

interface Props {
  diagrams: EditorDiagram[];
  activeId: string | null;
  dirtyIds: Set<string>;
  canAdd: boolean;
  dispatch: Dispatch<EditorAction>;
}

export function DiagramTabs({ diagrams, activeId, dirtyIds, canAdd, dispatch }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface px-3 py-2">
      {diagrams.map((d) => {
        const active = d.id === activeId;
        return (
          <div
            key={d.id}
            className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-sm ${
              active ? 'border-blue bg-blue/10' : 'border-border bg-bg'
            }`}
          >
            {active ? (
              <input
                aria-label="Diagram title"
                value={d.title}
                onChange={(e) => dispatch({ type: 'renameDiagram', id: d.id, title: e.target.value })}
                maxLength={SCENE_LIMITS.titleLength}
                className="w-28 bg-transparent text-ink focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'selectDiagram', id: d.id })}
                className="text-slate"
              >
                {d.title}
              </button>
            )}
            {dirtyIds.has(d.id) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-orange" />}
            {active && (
              <>
                <button
                  type="button"
                  aria-label="Move diagram left"
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'left' })}
                >
                  <ChevronLeft className="h-4 w-4 text-slate" />
                </button>
                <button
                  type="button"
                  aria-label="Move diagram right"
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'right' })}
                >
                  <ChevronRight className="h-4 w-4 text-slate" />
                </button>
                <button
                  type="button"
                  aria-label="Delete diagram"
                  onClick={() => dispatch({ type: 'deleteDiagram', id: d.id })}
                >
                  <Trash2 className="h-4 w-4 text-red" />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label="Add diagram"
        disabled={!canAdd}
        onClick={() => dispatch({ type: 'addDiagram' })}
        className="shrink-0 rounded-md border border-border p-1 text-slate disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
