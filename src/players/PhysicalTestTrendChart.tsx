import type { TrendSeries } from './physicalTestChart';

const WIDTH = 340;
const HEIGHT = 150;
const PAD_X = 8;
const PAD_TOP = 20;
const PAD_BOTTOM = 28;

interface PhysicalTestTrendChartProps {
  series: TrendSeries;
}

export function PhysicalTestTrendChart({ series }: PhysicalTestTrendChartProps) {
  const { points, unit, lowerIsBetter } = series;

  if (points.length === 0) return null;

  if (points.length === 1) {
    return (
      <div className="mb-4 rounded-md border border-border bg-bg p-3 text-sm text-slate">
        {points[0].date}: <span className="font-medium text-ink">{points[0].value} {unit}</span>
        <p className="mt-1 text-xs text-slate">Add another entry to see a trend.</p>
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
    <div className="mb-4 rounded-md border border-border bg-bg p-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block w-full" role="img" aria-label={`Trend: ${summary}`}>
        <polyline points={linePoints} fill="none" className="stroke-blue" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={xFor(i)}
            cy={yFor(p.value)}
            r={i === lastIndex ? 4 : 2.5}
            className="fill-blue"
          />
        ))}
        {showMaxLabel && (
          <text x={xFor(maxIndex)} y={yFor(max) - 8} textAnchor={anchorForIndex(maxIndex)} className="fill-slate text-[9px]">
            {max} {unit}
          </text>
        )}
        {showMinLabel && (
          <text x={xFor(minIndex)} y={yFor(min) + 14} textAnchor={anchorForIndex(minIndex)} className="fill-slate text-[9px]">
            {min} {unit}
          </text>
        )}
        <text x={xFor(lastIndex)} y={yFor(latest.value) - 8} textAnchor="end" className="fill-ink text-[10px] font-medium">
          {latest.value} {unit}
        </text>
        <text x={PAD_X} y={HEIGHT - 6} textAnchor="start" className="fill-slate text-[9px]">
          {points[0].date}
        </text>
        <text x={WIDTH - PAD_X} y={HEIGHT - 6} textAnchor="end" className="fill-slate text-[9px]">
          {latest.date}
        </text>
      </svg>
      {lowerIsBetter && <p className="mt-1 text-xs text-slate">Lower is better</p>}
    </div>
  );
}
