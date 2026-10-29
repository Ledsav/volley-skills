import type { Level } from '../types/player';
import { buildSkillRadar } from './skillRadar';
import { useT } from '../i18n/I18nProvider';

interface SkillRadarChartProps {
  scores: (number | null)[];
  labels: string[];
  level: Level | null;
}

const FILL_CLASS: Record<Level, string> = {
  Beginner: 'fill-red/15',
  Developing: 'fill-orange/15',
  Advanced: 'fill-blue/15',
  Elite: 'fill-green/15',
};

const VIEW_TOP = 46;
const VIEW_SIDE = 16;

const STROKE_CLASS: Record<Level, string> = {
  Beginner: 'stroke-red',
  Developing: 'stroke-orange',
  Advanced: 'stroke-blue',
  Elite: 'stroke-green',
};

export function SkillRadarChart({ scores, labels, level }: SkillRadarChartProps) {
  const r = useT().players.radar;
  const geometry = buildSkillRadar(scores, labels);
  const fillClass = level ? FILL_CLASS[level] : 'fill-ink/10';
  const strokeClass = level ? STROKE_CLASS[level] : 'stroke-ink-3';
  const summary = labels.map((label, i) => `${label} ${scores[i] ?? r.notRated}`).join(', ');

  return (
    <svg
      // Cropped to the web and its labels (the 320 square leaves ~50 px empty above and below) and a little wider for
      // long Italian labels, so the chart and its labels render near full size (≥ 12 px) in a 260–340 px column.
      viewBox={`${-VIEW_SIDE} ${VIEW_TOP} ${geometry.size + 2 * VIEW_SIDE} ${geometry.size - 2 * VIEW_TOP}`}
      className="mx-auto block w-full max-w-[340px] overflow-visible"
      role="img"
      aria-label={r.ariaLabel(summary)}
    >
      {geometry.gridPolygons.map((points, i) => (
        <polygon key={i} points={points} fill="none" className="stroke-separator" strokeWidth={1} />
      ))}
      {geometry.axisLines.map((point, i) => (
        <line key={i} x1={geometry.center} y1={geometry.center} x2={point.x} y2={point.y} className="stroke-separator" strokeWidth={1} />
      ))}
      <polygon points={geometry.polygonPoints} className={`${fillClass} ${strokeClass}`} strokeWidth={2} />
      {geometry.valuePoints.map((point, i) => (
        <circle key={i} cx={point.x} cy={point.y} r={3} className={strokeClass} fill="currentColor" />
      ))}
      {geometry.axisLabels.map((axis, i) => (
        <text key={i} x={axis.x} y={axis.y} textAnchor={axis.textAnchor} dominantBaseline="middle" className="fill-ink-2 text-[14px] font-medium">
          {axis.label}
        </text>
      ))}
    </svg>
  );
}
