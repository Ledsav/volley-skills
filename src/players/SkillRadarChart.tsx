import { buildSkillRadar } from './skillRadar';
import type { Level } from '../types/player';

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

const STROKE_CLASS: Record<Level, string> = {
  Beginner: 'stroke-red',
  Developing: 'stroke-orange',
  Advanced: 'stroke-blue',
  Elite: 'stroke-green',
};

export function SkillRadarChart({ scores, labels, level }: SkillRadarChartProps) {
  const geometry = buildSkillRadar(scores, labels);
  const fillClass = level ? FILL_CLASS[level] : 'fill-ink/10';
  const strokeClass = level ? STROKE_CLASS[level] : 'stroke-slate';
  const summary = labels.map((label, i) => `${label} ${scores[i] ?? 'not rated'}`).join(', ');

  return (
    <svg
      viewBox={`0 0 ${geometry.size} ${geometry.size}`}
      className="mx-auto block w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px]"
      role="img"
      aria-label={`Skills radar chart: ${summary}`}
    >
      {geometry.gridPolygons.map((points, i) => (
        <polygon key={i} points={points} fill="none" className="stroke-border" strokeWidth={1} />
      ))}
      {geometry.axisLines.map((point, i) => (
        <line key={i} x1={geometry.center} y1={geometry.center} x2={point.x} y2={point.y} className="stroke-border" strokeWidth={1} />
      ))}
      <polygon points={geometry.polygonPoints} className={`${fillClass} ${strokeClass}`} strokeWidth={2} />
      {geometry.valuePoints.map((point, i) => (
        <circle key={i} cx={point.x} cy={point.y} r={3} className={strokeClass} fill="currentColor" />
      ))}
      {geometry.axisLabels.map((axis, i) => (
        <text key={i} x={axis.x} y={axis.y} textAnchor={axis.textAnchor} dominantBaseline="middle" className="fill-slate text-[10px] font-medium">
          {axis.label}
        </text>
      ))}
    </svg>
  );
}
