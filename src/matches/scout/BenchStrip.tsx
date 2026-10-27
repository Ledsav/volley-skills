import type { RosterEntry } from '../../types/match';
import { useT } from '../../i18n/I18nProvider';

export function BenchStrip({ players, onSelect, disabled = false }: { players: RosterEntry[]; onSelect: (playerId: string) => void; disabled?: boolean }) {
  const t = useT();
  if (players.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1" aria-label={t.scout.bench}>
      <span className="text-xs text-slate">{t.scout.bench}</span>
      {players.map((p) => (
        <button
          key={p.playerId}
          type="button"
          aria-label={`#${p.number} ${p.name}`}
          disabled={disabled}
          onClick={() => onSelect(p.playerId)}
          className="min-h-11 min-w-11 shrink-0 rounded-md border border-dashed border-border bg-surface px-2 text-sm tabular-nums text-ink disabled:opacity-60"
        >
          {p.number}
        </button>
      ))}
    </div>
  );
}
