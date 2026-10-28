import { CornerDownRight, FileDown, Pencil, PenLine, Trash2, TriangleAlert } from 'lucide-react';
import type { ActionEvent, MatchEvent, RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';
import { describeEvent } from '../format';
import { engineWarningText, sortEvents, type MatchState } from '../scoutEngine';

interface TimelineDrawerProps {
  events: MatchEvent[];
  state: MatchState;
  roster: Map<string, RosterEntry>;
  onDelete: (ids: string[]) => void;
  onEdit: (ev: ActionEvent) => void;
  onInsertAfter: (eventId: string) => void;
}

export function TimelineDrawer({ events, state, roster, onDelete, onEdit, onInsertAfter }: TimelineDrawerProps) {
  const t = useT();
  const scoreAfter = new Map(state.rallies.map((r) => [r.endEventId, r.scoreAfter]));
  const warnings = new Map<string, string[]>();
  for (const w of state.warnings) warnings.set(w.eventId, [...(warnings.get(w.eventId) ?? []), engineWarningText(w, t)]);
  const rows = sortEvents(events).reverse();

  if (rows.length === 0) return <p className="p-4 text-center text-sm text-slate">{t.scout.timeline.empty}</p>;

  return (
    <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
      {rows.map((ev) => {
        const score = scoreAfter.get(ev.id);
        const warn = warnings.get(ev.id);
        const isHeader = ev.type === 'setStart' || ev.type === 'setEnd';
        return (
          <li key={ev.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${isHeader ? 'bg-bg font-semibold' : ''}`}>
            <div className="min-w-0 flex-1">
              <span className="text-ink">
                {ev.source === 'text' && <PenLine role="img" aria-label={t.scout.timeline.fromText} className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-slate" />}
                {ev.source === 'import' && <FileDown role="img" aria-label={t.scout.timeline.imported} className="mr-1 inline h-3.5 w-3.5 align-[-2px] text-slate" />}
                {describeEvent(ev, roster)}
              </span>
              {warn && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-orange-strong">
                  <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                  {warn.join(' ')}
                </span>
              )}
            </div>
            {score && (
              <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {score.us}–{score.them}
              </span>
            )}
            <button type="button" aria-label={t.scout.timeline.insertAfter} onClick={() => onInsertAfter(ev.id)} className="flex h-11 w-11 items-center justify-center rounded-md text-slate hover:bg-bg">
              <CornerDownRight size={16} aria-hidden="true" />
            </button>
            {ev.type === 'action' && (
              <button type="button" aria-label={t.scout.timeline.edit} onClick={() => onEdit(ev)} className="flex h-11 w-11 items-center justify-center rounded-md text-blue-strong hover:bg-blue/10">
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" aria-label={t.scout.timeline.delete} onClick={() => onDelete([ev.id])} className="flex h-11 w-11 items-center justify-center rounded-md text-red-strong hover:bg-red/10">
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
