import type { TrendSeries } from './physicalTestChart';
import { useT } from '../i18n/I18nProvider';

const WIDTH = 340;
const HEIGHT = 150;
const PAD_X = 8;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;

interface PhysicalTestTrendChartProps {
  series: TrendSeries;
}

export function PhysicalTestTrendChart({ series }: PhysicalTestTrendChartProps) {
  const c = useT().players.physical;
  const { points, lowerIsBetter } = series;
  // 'reps' is the one unit that is a word; cm, kg, s and ms read the same everywhere.
  const unit = series.unit === 'reps' ? c.repsUnit : series.unit;

  if (points.length === 0) return null;

  if (points.length === 1) {
    return (
      <div className="mb-4 rounded-lg bg-surface-2 p-3 text-callout text-ink-2">
        {points[0].date}: <span className="font-medium tabular-nums text-ink">{points[0].value} {unit}</span>
        <p className="mt-1 text-footnote text-ink-2">{c.chart.addAnother}</p>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotWidth = WIDTH - PAD_X * 2;

  // Oriented so a better result always plots higher, regardless of whether the raw metric is a distance or a time.
  function yFor(value: number): number {
    const fraction = range === 0 ? 0.5 : (value - min) / range;
    const eased = lowerIsBetter ? fraction : 1 - fraction;
    return PAD_TOP + eased * plotHeight;
  }

  function xFor(index: number): number {
    return PAD_X + (points.length === 1 ? 0 : (index / (points.length - 1)) * plotWidth);
  }

  // Anchor away from the centre at the first/last point so the label text can't run off the edge of the viewBox.
  function anchorForIndex(index: number): 'start' | 'middle' | 'end' {
    if (index === 0) return 'start';
    if (index === points.length - 1) return 'end';
    return 'middle';
  }

  const linePoints = points.map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)}`).join(' ');
  const lastIndex = points.length - 1;
  const latest = points[lastIndex];
  const maxIndex = values.indexOf(max);
  const minIndex = values.indexOf(min);
  // Skip a min/max callout that would land on the same point as the bolded "latest" label.
  const showMaxLabel = maxIndex !== minIndex && maxIndex !== lastIndex;
  const showMinLabel = minIndex !== lastIndex;
  const summary = points.map((p) => `${p.date}: ${p.value} ${unit}`).join(', ');

  return (
    <div className="mb-4 rounded-lg bg-surface-2 p-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full" role="img" aria-label={c.chart.ariaLabel(summary)}>
        <polyline points={linePoints} fill="none" className="stroke-ink" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={i === lastIndex ? 4 : 2.5}
            className="fill-ink"
          />
        ))}
        {showMaxLabel && (
          <text x={xFor(maxIndex)} y={yFor(max) - 8} textAnchor={anchorForIndex(maxIndex)} className="fill-ink-2 text-[11px]">
            {max} {unit}
          </text>
        )}
        {showMinLabel && (
          <text x={xFor(minIndex)} y={yFor(min) + 14} textAnchor={anchorForIndex(minIndex)} className="fill-ink-2 text-[11px]">
            {min} {unit}
          </text>
        )}
        <text x={xFor(lastIndex)} y={yFor(latest.value) - 8} textAnchor="end" className="fill-ink text-[11px] font-medium">
          {latest.value} {unit}
        </text>
        <text x={PAD_X} y={HEIGHT - 6} textAnchor="start" className="fill-ink-2 text-[11px]">
          {points[0].date}
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end" className="fill-ink-2 text-[11px]">
          {latest.date}
        </text>
      </svg>
      {lowerIsBetter && <p className="mt-1 text-footnote text-ink-2">{c.chart.lowerIsBetter}</p>}
    </div>
  );
}
