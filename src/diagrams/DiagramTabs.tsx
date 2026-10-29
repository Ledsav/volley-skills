import type { Dispatch } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { SCENE_LIMITS } from '../types/diagram';
import type { EditorAction, EditorDiagram } from './useDiagramEditor';
import { useT } from '../i18n/I18nProvider';

interface Props {
  diagrams: EditorDiagram[];
  activeId: string | null;
  dirtyIds: Set<string>;
  canAdd: boolean;
  dispatch: Dispatch<EditorAction>;
}

export function DiagramTabs({ diagrams, activeId, dirtyIds, canAdd, dispatch }: Props) {
  const t = useT().diagrams.tabs;
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto px-2 py-1.5 lg:flex-wrap lg:overflow-visible">
      {diagrams.map((d) => {
        const active = d.id === activeId;
        return (
          <div
            key={d.id}
            className={`flex shrink-0 items-center gap-1 rounded-lg ${active ? 'bg-surface-3 px-2' : ''}`}
          >
            {active ? (
              <input
                aria-label={t.title}
                value={d.title}
                onChange={(e) => dispatch({ type: 'renameDiagram', id: d.id, title: e.target.value })}
                maxLength={SCENE_LIMITS.titleLength}
                className="min-h-11 w-28 rounded-sm bg-transparent text-base text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
              />
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'selectDiagram', id: d.id })}
                className="min-h-11 rounded-lg px-3 text-callout text-ink-2 hover:bg-surface-2"
              >
                {d.title}
              </button>
            )}
            {dirtyIds.has(d.id) && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ink-2" />}
            {active && (
              <>
                <button
                  type="button"
                  aria-label={t.moveLeft}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'left' })}
                >
                  <ChevronLeft className="h-4 w-4 text-ink-2" />
                </button>
                <button
                  type="button"
                  aria-label={t.moveRight}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'right' })}
                >
                  <ChevronRight className="h-4 w-4 text-ink-2" />
                </button>
                <button
                  type="button"
                  aria-label={t.delete}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center"
                  onClick={() => dispatch({ type: 'deleteDiagram', id: d.id })}
                >
                  <Trash2 className="h-4 w-4 text-red-strong" />
                </button>
              </>
            )}
          </div>
        );
      })}
      <button
        type="button"
        aria-label={t.add}
        disabled={!canAdd}
        onClick={() => dispatch({ type: 'addDiagram' })}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
