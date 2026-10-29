import { fmtEff, fmtPct } from '../../matches/format';
import type { TrendPoint } from './teamSeason';
import { useT } from '../../i18n/I18nProvider';
import { useMediaQuery } from '../../components/useMediaQuery';
import { formatDate } from '../../i18n/format';

// The viewBox width follows the screen so SVG text renders near its nominal
// size: a 640-wide box squeezed onto a phone would shrink 11px labels to ~6px.
const W_WIDE = 640, W_NARROW = 320;
const H = 180, PAD_L = 36, PAD_R = 8, PAD_T = 12, PAD_B = 26;
const Y_MAX = 1;
const SERIES = [
  { key: 'sideOut', className: 'stroke-ink', dash: undefined },
  { key: 'attackEff', className: 'stroke-ink-2', dash: '6 4' },
  { key: 'receptionPos', className: 'stroke-ink-3', dash: '2 3' },
] as const;

export function TeamTrendChart({ points }: { points: TrendPoint[] }) {
  const t = useT().teams.stats;
  const seriesLabel = { sideOut: t.sideOutPct, attackEff: t.attackEff, receptionPos: t.receptionPos };
  const W = useMediaQuery('(min-width: 640px)') ? W_WIDE : W_NARROW;
  if (points.length < 2) return <p className="text-callout text-ink-2">{t.trendNone}</p>;
  // The floor follows the data (attack efficiency can go negative), so a season with no negative values has no
  // empty band under 0%.
  const lowest = Math.min(0, ...points.flatMap((p) => SERIES.map((s) => p[s.key] ?? 0)));
  const Y_MIN = lowest < 0 ? Math.max(-1, Math.floor(lowest * 4) / 4) : 0;
  const grid = Y_MIN < 0 ? [Y_MIN, 0, 0.5, 1] : [0, 0.5, 1];
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + ((Y_MAX - Math.max(Y_MIN, Math.min(Y_MAX, v))) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);
  const path = (key: (typeof SERIES)[number]['key']) =>
    points
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null)
      .map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');
  return (
    <figure className="break-inside-avoid rounded-lg bg-surface p-4 shadow-card">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full [print-color-adjust:exact]" aria-hidden="true">
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(g)} y2={y(g)} className="stroke-separator" strokeDasharray={g === 0 ? undefined : '3 3'} />
            <text x={PAD_L - 4} y={y(g) + 4} textAnchor="end" className="fill-ink-2 text-[11px]">{g < 0 ? `−${Math.round(-g * 100)}` : Math.round(g * 100)}%</text>
          </g>
        ))}
        {SERIES.map((s) => <path key={s.key} d={path(s.key)} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.dash} className={s.className} />)}
        {points.map((p, i) => (
          <text key={p.matchId} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[11px] font-bold ${p.won ? 'fill-green-strong' : 'fill-red-strong'}`}>
            {p.won ? t.wonShort : t.lostShort}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-footnote text-ink-2">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" strokeWidth="3" strokeLinecap="round" strokeDasharray={s.dash} className={s.className} /></svg>
            {seriesLabel[s.key]}
          </span>
        ))}
      </figcaption>
      {/* The wrapper carries sr-only: a table's intrinsic width ignores its own 1px box and widened phone pages. */}
      <div className="sr-only">
      <table aria-label={t.trendData}>
        <thead><tr><th scope="col">{t.date}</th><th scope="col">{t.opponent}</th><th scope="col">{t.result}</th>{SERIES.map((s) => <th key={s.key} scope="col">{seriesLabel[s.key]}</th>)}</tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.matchId}>
              <td>{formatDate(p.date, 'short')}</td><td>{p.opponent}</td><td>{p.won ? t.won : t.lost}</td>
              <td>{fmtPct(p.sideOut)}</td><td>{fmtEff(p.attackEff)}</td><td>{fmtPct(p.receptionPos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
