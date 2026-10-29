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

const TAB_ICON =
  'inline-flex h-11 w-10 items-center justify-center rounded-md text-ink-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus';

export function DiagramTabs({ diagrams, activeId, dirtyIds, canAdd, dispatch }: Props) {
  const t = useT().diagrams.tabs;
  return (
    <div className="flex items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible">
      {diagrams.map((d) => {
        const active = d.id === activeId;
        return (
          <div
            key={d.id}
            className={`flex shrink-0 items-center rounded-md ${active ? 'bg-surface-3 pl-3' : ''}`}
          >
            {active ? (
              <input
                aria-label={t.title}
                value={d.title}
                onChange={(e) => dispatch({ type: 'renameDiagram', id: d.id, title: e.target.value })}
                maxLength={SCENE_LIMITS.titleLength}
                className="min-h-11 w-28 rounded-sm bg-transparent text-base font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:text-callout"
              />
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'selectDiagram', id: d.id })}
                className="pressable min-h-11 rounded-md px-3 text-callout text-ink-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                {d.title}
              </button>
            )}
            {dirtyIds.has(d.id) && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full bg-ink-2 ${active ? 'ml-1' : '-ml-1 mr-2'}`} />}
            {active && (
              <>
                <button
                  type="button"
                  aria-label={t.moveLeft}
                  className={TAB_ICON}
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'left' })}
                >
                  <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t.moveRight}
                  className={TAB_ICON}
                  onClick={() => dispatch({ type: 'reorderDiagram', id: d.id, direction: 'right' })}
                >
                  <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t.delete}
                  className={`${TAB_ICON} hover:!text-red-strong`}
                  onClick={() => dispatch({ type: 'deleteDiagram', id: d.id })}
                >
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
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
        className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-40"
      >
        <Plus className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}
