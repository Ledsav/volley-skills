import { fmtEff, fmtPct } from '../../matches/format';
import type { TrendPoint } from './teamSeason';
import { useT } from '../../i18n/I18nProvider';
import { useMediaQuery } from '../../components/useMediaQuery';

// The viewBox width follows the screen so SVG text renders near its nominal
// size: a 640-wide box squeezed onto a phone would shrink 11px labels to ~6px.
const W_WIDE = 640, W_NARROW = 320;
const H = 200, PAD_L = 36, PAD_R = 8, PAD_T = 12, PAD_B = 28;
const Y_MIN = -0.5, Y_MAX = 1;
const SERIES = [
  { key: 'sideOut', className: 'stroke-blue' },
  { key: 'attackEff', className: 'stroke-orange' },
  { key: 'receptionPos', className: 'stroke-green' },
] as const;

export function TeamTrendChart({ points }: { points: TrendPoint[] }) {
  const t = useT().teams.stats;
  const seriesLabel = { sideOut: t.sideOutPct, attackEff: t.attackEff, receptionPos: t.receptionPos };
  const W = useMediaQuery('(min-width: 640px)') ? W_WIDE : W_NARROW;
  if (points.length < 2) return <p className="text-sm text-slate">{t.trendNone}</p>;
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + ((Y_MAX - Math.max(Y_MIN, Math.min(Y_MAX, v))) / (Y_MAX - Y_MIN)) * (H - PAD_T - PAD_B);
  const path = (key: (typeof SERIES)[number]['key']) =>
    points
      .map((p, i) => ({ v: p[key], i }))
      .filter((p): p is { v: number; i: number } => p.v !== null)
      .map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(' ');
  return (
    <figure className="break-inside-avoid">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full [print-color-adjust:exact]" aria-hidden="true">
        {[0, 0.5, 1].map((g) => (
          <g key={g}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(g)} y2={y(g)} className="stroke-border" strokeDasharray={g === 0 ? undefined : '3 3'} />
            <text x={PAD_L - 4} y={y(g) + 4} textAnchor="end" className="fill-slate text-[11px]">{g * 100}%</text>
          </g>
        ))}
        {SERIES.map((s) => <path key={s.key} d={path(s.key)} fill="none" strokeWidth={2} className={s.className} />)}
        {points.map((p, i) => (
          <text key={p.matchId} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[11px] font-bold ${p.won ? 'fill-green-strong' : 'fill-red-strong'}`}>
            {p.won ? t.wonShort : t.lostShort}
          </text>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-slate">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" strokeWidth="3" className={s.className} /></svg>
            {seriesLabel[s.key]}
          </span>
        ))}
      </figcaption>
      <table className="sr-only" aria-label={t.trendData}>
        <thead><tr><th scope="col">{t.date}</th><th scope="col">{t.opponent}</th><th scope="col">{t.result}</th>{SERIES.map((s) => <th key={s.key} scope="col">{seriesLabel[s.key]}</th>)}</tr></thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.matchId}>
              <td>{p.date}</td><td>{p.opponent}</td><td>{p.won ? t.won : t.lost}</td>
              <td>{fmtPct(p.sideOut)}</td><td>{fmtEff(p.attackEff)}</td><td>{fmtPct(p.receptionPos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
