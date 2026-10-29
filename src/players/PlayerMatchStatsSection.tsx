import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { formatDate } from '../i18n/format';
import { TabEmptyState } from '../teams/TabEmptyState';
import { StatTile } from '../components/StatTile';
import { fmtEff, fmtPct } from '../matches/format';
import type { SeasonStats } from './matchRating';
import { useT } from '../i18n/I18nProvider';
import type { Gender } from '../i18n/catalog';

interface PlayerMatchStatsSectionProps {
  teamId: string;
  /** null while loading. */
  season: SeasonStats | null;
  error: boolean;
  gender?: Gender;
}

export function PlayerMatchStatsSection({ teamId, season, error, gender = 'mixed' }: PlayerMatchStatsSectionProps) {
  const m = useT().players.matchStats;
  // The section has no card of its own: the tiles sit on the canvas and the table brings its card (no card-in-card).
  const card = 'rounded-lg bg-surface p-4 shadow-card';
  if (error) return <p role="alert" className={`${card} text-callout text-red-strong`}>{m.loadError}</p>;
  if (!season) return <p className={`${card} text-callout text-ink-2`}>{m.loading}</p>;
  if (season.matchesPlayed === 0) return <div className={card}><TabEmptyState icon={Trophy} title={m.none(gender)} /></div>;

  const th = 'sticky top-0 bg-surface px-2 py-2 text-caption font-medium text-ink-2';
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label={m.matches} value={String(season.matchesPlayed)} />
        <StatTile label={m.attackEff} value={fmtEff(season.attackEff)} />
        <StatTile label={m.serveEff} value={fmtEff(season.serveEff)} />
        <StatTile label={m.receptionPos} value={fmtPct(season.receptionPos)} />
        <StatTile label={m.ptsErr} value={`${season.points} / ${season.errors}`} />
      </div>
      <div className={`overflow-x-auto ${card} py-2`}>
        <table className="w-full text-callout tabular-nums">
          <thead className="text-left">
            <tr>
              <th scope="col" className={th}>{m.date}</th>
              <th scope="col" className={th}>{m.opponent}</th>
              <th scope="col" className={th}>{m.attEffCol}</th>
              <th scope="col" className={th}>{m.serveEffCol}</th>
              <th scope="col" className={th}>{m.recPosCol}</th>
              <th scope="col" className={th}>{m.ptsErr}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {season.rows.map((row) => (
              <tr key={row.matchId}>
                <td className="whitespace-nowrap px-2 py-2 text-ink-2" title={row.date}>{formatDate(row.date, 'short')}</td>
                <td className="px-2 py-2">
                  <Link to={`/teams/${teamId}/matches/${row.matchId}`} className="text-ink underline-offset-2 hover:underline">
                    {row.opponent}
                  </Link>
                </td>
                <td className="px-2">{fmtEff(row.attackEff)}</td>
                <td className="px-2">{fmtEff(row.serveEff)}</td>
                <td className="px-2">{fmtPct(row.receptionPos)}</td>
                <td className="px-2">{row.points} / {row.errors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
