import type { RosterEntry } from '../../types/match';
import { tapFlash } from '../../motion/tapFlash';
import { useT } from '../../i18n/I18nProvider';
import { ScrollStrip } from '../../components/ScrollStrip';

interface BenchStripProps {
  players: RosterEntry[];
  /** Short display names (see `shortNames`), keyed by player id. */
  names: Map<string, string>;
  onSelect: (playerId: string) => void;
  disabled?: boolean;
}

export function BenchStrip({ players, names, onSelect, disabled = false }: BenchStripProps) {
  const t = useT();
  if (players.length === 0) return null;
  return (
    <ScrollStrip className="flex items-center gap-2 py-1" aria-label={t.scout.bench}>
      <span className="text-caption text-ink-2">{t.scout.bench}</span>
      {players.map((p) => (
        <button
          key={p.playerId}
          type="button"
          aria-label={`#${p.number} ${p.name}`}
          disabled={disabled}
          onPointerDown={(e) => {
            if (!disabled) tapFlash(e.currentTarget);
          }}
          onClick={() => onSelect(p.playerId)}
          className="flex min-h-14 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-separator bg-surface px-3 text-ink disabled:opacity-60 md:min-h-11"
        >
          <span className="max-w-[7rem] truncate text-sm font-bold">{names.get(p.playerId) ?? p.name}</span>
          <span className="text-caption tabular-nums text-ink-2">#{p.number}</span>
        </button>
      ))}
    </ScrollStrip>
  );
}
