import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown } from 'lucide-react';
import { fmtEff, fmtPct } from '../../matches/format';
import type { TeamPlayerRow } from './teamSeason';
import { isWeakAttack, isWeakReception, WEAK_CLASS } from '../../matches/statFlags';
import { formatNumber } from '../../i18n/format';
import { useT } from '../../i18n/I18nProvider';

type SortKey = 'number' | 'matchesPlayed' | 'points' | 'errors' | 'mvpAvg' | 'attackEff' | 'serveEff' | 'receptionPos';
// `weak` uses the same thresholds as the live panel and match report. Season error
// totals aren't flagged: the per-match threshold doesn't apply to a sum.
const COLS: { key: SortKey; fmt: (r: TeamPlayerRow) => string; weak?: (r: TeamPlayerRow) => boolean }[] = [
  { key: 'matchesPlayed', fmt: (r) => String(r.matchesPlayed) },
  { key: 'points', fmt: (r) => String(r.points) },
  { key: 'errors', fmt: (r) => String(r.errors) },
  { key: 'mvpAvg', fmt: (r) => (r.mvpAvg === null ? '—' : formatNumber(r.mvpAvg, 1)) },
  { key: 'attackEff', fmt: (r) => fmtEff(r.attackEff), weak: (r) => isWeakAttack(r.attackEff) },
  { key: 'serveEff', fmt: (r) => fmtEff(r.serveEff) },
  { key: 'receptionPos', fmt: (r) => fmtPct(r.receptionPos), weak: (r) => isWeakReception(r.receptionPos) },
];
const RATED = ['serve', 'reception', 'attack', 'block', 'set', 'defence'] as const;

export function PlayerStatsTable({ teamId, rows }: { teamId: string; rows: TeamPlayerRow[] }) {
  const tt = useT();
  const t = tt.teams.stats;
  const colLabel: Record<SortKey, string> = {
    number: '#', matchesPlayed: t.table.mp, points: t.table.points, errors: t.table.errors, mvpAvg: t.table.mvp,
    attackEff: t.table.attEff, serveEff: t.table.serveEff, receptionPos: t.table.recPos,
  };
  const [sort, setSort] = useState<SortKey>('number');
  const sorted = [...rows].sort((a, b) => {
    if (sort === 'number') return (a.number ?? 999) - (b.number ?? 999);
    return ((b[sort] as number | null) ?? -Infinity) - ((a[sort] as number | null) ?? -Infinity);
  });
  return (
    <div className="overflow-x-auto rounded-lg bg-surface shadow-card print:overflow-visible print:shadow-none">
      <table className="w-full text-callout tabular-nums">
        <thead>
          <tr className="text-left text-caption text-ink-2">
            <th scope="col" className="py-1 pl-4 pr-2"><button type="button" onClick={() => setSort('number')} className="min-h-11 font-medium">#</button></th>
            <th scope="col" className="sticky left-0 z-10 bg-surface py-1 pr-2 text-left">{t.table.name}</th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" className="py-1 pr-2 text-right" aria-sort={sort === c.key ? 'descending' : 'none'}>
                <button type="button" onClick={() => setSort(c.key)} className="inline-flex min-h-11 items-center gap-1 font-medium">
                  {colLabel[c.key]}{sort === c.key && <ArrowDown size={12} aria-hidden="true" />}
                </button>
              </th>
            ))}
            {RATED.map((k) => (
              <th key={k} scope="col" className="py-1 pr-2 text-right font-medium">{tt.labels.playerSkill[k]}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-separator">
          {sorted.map((r) => (
            <tr key={r.playerId} className="min-h-[52px]">
              <td className="py-3 pl-4 pr-2 text-ink-2">{r.number ?? '—'}</td>
              <th scope="row" className="sticky left-0 z-10 bg-surface py-3 pr-2 text-left font-normal">
                {r.current ? <Link to={`/teams/${teamId}/players/${r.playerId}`} className="text-ink hover:underline">{r.name}</Link> : <span className="text-ink">{r.name}</span>}
              </th>
              {COLS.map((c) => <td key={c.key} className={`py-3 pr-2 text-right ${c.weak?.(r) ? WEAK_CLASS : 'text-ink'}`}>{c.fmt(r)}</td>)}
              {RATED.map((k) => <td key={k} className="py-3 pr-2 text-right text-ink">{r.ratings[k]?.rating != null ? formatNumber(r.ratings[k]!.rating!, 1) : '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
