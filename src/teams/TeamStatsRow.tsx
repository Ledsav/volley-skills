import { computeTeamAvgScore } from '../players/skillMath';
import type { Player } from '../types/player';
import { StatTile } from '../components/StatTile';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';

export function TeamStatsRow({ players }: { players: Player[] }) {
  const t = useT().teams.statsRow;
  const avg = computeTeamAvgScore(players);
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-sm">
      <StatTile value={String(players.length)} label={t.players} />
      <StatTile value={avg !== null ? formatNumber(avg, 1) : '—'} label={t.avgSkill} />
    </div>
  );
}
