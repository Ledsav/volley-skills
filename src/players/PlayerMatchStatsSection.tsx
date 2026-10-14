import { Link } from 'react-router-dom';
import { fmtEff, fmtPct } from '../matches/format';
import type { SeasonStats } from './matchRating';

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
  if (error) return <p role="alert" className="text-sm text-red">Could not load match stats.</p>;
  if (!season) return <p className="text-sm text-slate">Loading match stats…</p>;
  if (season.matchesPlayed === 0) return <p className="text-sm text-slate">No scouted matches for this player yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Matches" value={String(season.matchesPlayed)} />
        <Stat label="Attack eff." value={fmtEff(season.attackEff)} />
        <Stat label="Serve eff." value={fmtEff(season.serveEff)} />
        <Stat label="Reception +" value={fmtPct(season.receptionPos)} />
        <Stat label="Pts / Err" value={`${season.points} / ${season.errors}`} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-bg text-left text-xs uppercase text-slate">
            <tr>
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Opponent</th>
              <th className="px-2 py-2 font-medium">Att. eff</th>
              <th className="px-2 py-2 font-medium">Serve eff</th>
              <th className="px-2 py-2 font-medium">Rec +</th>
              <th className="px-2 py-2 font-medium">Pts / Err</th>
            </tr>
          </thead>
          <tbody>
            {season.rows.map((row) => (
              <tr key={row.matchId} aria-label={`${row.date} vs ${row.opponent}`} className="border-t border-border">
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
