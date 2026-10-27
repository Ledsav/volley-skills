import { Link } from 'react-router-dom';
import { fmtEff, fmtPct } from '../matches/format';
import type { SeasonStats } from './matchRating';
import { useT } from '../i18n/I18nProvider';

interface PlayerMatchStatsSectionProps {
  teamId: string;
  /** null while loading. */
  season: SeasonStats | null;
  error: boolean;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-xs text-slate">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function PlayerMatchStatsSection({ teamId, season, error }: PlayerMatchStatsSectionProps) {
  const m = useT().players.matchStats;
  if (error) return <p role="alert" className="text-sm text-red">{m.loadError}</p>;
  if (!season) return <p className="text-sm text-slate">{m.loading}</p>;
  if (season.matchesPlayed === 0) return <p className="text-sm text-slate">{m.none}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label={m.matches} value={String(season.matchesPlayed)} />
        <Stat label={m.attackEff} value={fmtEff(season.attackEff)} />
        <Stat label={m.serveEff} value={fmtEff(season.serveEff)} />
        <Stat label={m.receptionPos} value={fmtPct(season.receptionPos)} />
        <Stat label={m.ptsErr} value={`${season.points} / ${season.errors}`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-bg text-left text-xs uppercase text-slate">
            <tr>
              <th scope="col" className="px-2 py-2 font-medium">{m.date}</th>
              <th scope="col" className="px-2 py-2 font-medium">{m.opponent}</th>
              <th scope="col" className="px-2 py-2 font-medium">{m.attEffCol}</th>
              <th scope="col" className="px-2 py-2 font-medium">{m.serveEffCol}</th>
              <th scope="col" className="px-2 py-2 font-medium">{m.recPosCol}</th>
              <th scope="col" className="px-2 py-2 font-medium">{m.ptsErr}</th>
            </tr>
          </thead>
          <tbody>
            {season.rows.map((row) => (
              <tr key={row.matchId} className="border-t border-border">
                <td className="whitespace-nowrap px-2 py-2 text-slate">{row.date}</td>
                <td className="px-2 py-2">
                  <Link to={`/teams/${teamId}/matches/${row.matchId}`} className="text-blue hover:underline">
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
