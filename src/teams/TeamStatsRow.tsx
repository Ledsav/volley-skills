import { computeTeamAvgScore } from '../players/skillMath';
import type { Player } from '../types/player';

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
      <div className="text-3xl font-extrabold tracking-[-0.02em] tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-xs text-slate">{label}</div>
    </div>
  );
}

export function TeamStatsRow({ players }: { players: Player[] }) {
  const avg = computeTeamAvgScore(players);
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-xs">
      <StatTile value={String(players.length)} label="Players" />
      <StatTile value={avg !== null ? avg.toFixed(1) : '—'} label="Avg. skill" />
    </div>
  );
}
