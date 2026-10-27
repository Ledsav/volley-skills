import { computeTeamAvgScore } from '../players/skillMath';
import type { Player } from '../types/player';
import { StatTile } from '../components/StatTile';
import { formatNumber } from '../i18n/format';

export function TeamStatsRow({ players }: { players: Player[] }) {
  const avg = computeTeamAvgScore(players);
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-xs">
      <StatTile value={String(players.length)} label="Players" />
      <StatTile value={avg !== null ? formatNumber(avg, 1) : '—'} label="Avg. skill" />
    </div>
  );
}
