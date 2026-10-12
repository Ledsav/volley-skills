import type { RosterEntry } from '../../types/match';

export function BenchStrip({ players, onSelect }: { players: RosterEntry[]; onSelect: (playerId: string) => void }) {
  if (players.length === 0) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1" aria-label="Bench">
      <span className="text-xs text-slate">Bench</span>
      {players.map((p) => (
        <button
          key={p.playerId}
          type="button"
          aria-label={`#${p.number} ${p.name}`}
          onClick={() => onSelect(p.playerId)}
          className="min-h-11 min-w-11 shrink-0 rounded-md border border-dashed border-border bg-surface px-2 text-sm tabular-nums text-ink"
        >
          {p.number}
        </button>
      ))}
    </div>
  );
}
