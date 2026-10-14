import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import { fmtEff, fmtPct } from '../../matches/format';
import type { TeamPlayerRow } from './teamSeason';

type SortKey = 'number' | 'matchesPlayed' | 'points' | 'errors' | 'mvpAvg' | 'attackEff' | 'serveEff' | 'receptionPos';
const COLS: { key: SortKey; label: string; fmt: (r: TeamPlayerRow) => string }[] = [
  { key: 'matchesPlayed', label: 'MP', fmt: (r) => String(r.matchesPlayed) },
  { key: 'points', label: 'Points', fmt: (r) => String(r.points) },
  { key: 'errors', label: 'Errors', fmt: (r) => String(r.errors) },
  { key: 'mvpAvg', label: 'MVP', fmt: (r) => (r.mvpAvg === null ? '—' : r.mvpAvg.toFixed(1)) },
  { key: 'attackEff', label: 'Att. eff.', fmt: (r) => fmtEff(r.attackEff) },
  { key: 'serveEff', label: 'Serve eff.', fmt: (r) => fmtEff(r.serveEff) },
  { key: 'receptionPos', label: 'Rec. +', fmt: (r) => fmtPct(r.receptionPos) },
];
const RATED = ['serve', 'reception', 'attack', 'block', 'set', 'defence'] as const;

export function PlayerStatsTable({ teamId, rows }: { teamId: string; rows: TeamPlayerRow[] }) {
  const [sort, setSort] = useState<SortKey>('number');
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'number') return (a.number ?? 999) - (b.number ?? 999);
    return ((b[sort] as number | null) ?? -Infinity) - ((a[sort] as number | null) ?? -Infinity);
  });
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-left text-slate">
            <th scope="col" className="py-2 pr-2"><button type="button" onClick={() => setSort('number')} className="font-medium">#</button></th>
            <th scope="col" className="py-2 pr-2">Name</th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" className="py-2 pr-2 text-right" aria-sort={sort === c.key ? 'descending' : 'none'}>
                <button type="button" onClick={() => setSort(c.key)} className="inline-flex items-center gap-1 font-medium">
                  {c.label}{sort === c.key && <ArrowDown size={12} aria-hidden="true" />}
                </button>
              </th>
            ))}
            {RATED.map((k) => (
              <th key={k} scope="col" className="py-2 pr-2 text-right font-medium">{k[0].toUpperCase() + k.slice(1)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.playerId} className="border-b border-border last:border-0">
              <td className="py-2 pr-2 text-slate">{r.number ?? '—'}</td>
              <th scope="row" className="py-2 pr-2 text-left font-normal">
                {r.current ? <Link to={`/teams/${teamId}/players/${r.playerId}`} className="text-ink hover:underline">{r.name}</Link> : <span className="text-ink">{r.name}</span>}
              </th>
              {COLS.map((c) => <td key={c.key} className="py-2 pr-2 text-right text-ink">{c.fmt(r)}</td>)}
              {RATED.map((k) => <td key={k} className="py-2 pr-2 text-right text-ink">{r.ratings[k]?.rating?.toFixed(1) ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
