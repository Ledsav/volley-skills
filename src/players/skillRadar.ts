/** Pure geometry for an 8-axis skill radar/spider chart, laid out on a 320×320 viewBox. */

export interface RadarPoint {
  x: number;
  y: number;
}

export interface RadarAxisLabel {
  label: string;
  x: number;
  y: number;
  textAnchor: 'start' | 'middle' | 'end';
}

export interface RadarGeometry {
  size: number;
  center: number;
  maxRadius: number;
  valuePoints: RadarPoint[];
  polygonPoints: string;
  gridPolygons: string[];
  axisLines: RadarPoint[];
  axisLabels: RadarAxisLabel[];
}

const SIZE = 320;
const CENTER = SIZE / 2;
const MAX_RADIUS = 74;
// Leaves ~60px of side margin at the widest label points, enough for the longest label ("Reception") without clipping.
const LABEL_RADIUS = MAX_RADIUS + 24;
const GRID_LEVELS = [4, 6, 8, 10];
const MAX_SCORE = 10;

function angleForIndex(index: number, count: number): number {
  return -90 + (360 / count) * index;
}

function pointAt(angleDeg: number, radius: number): RadarPoint {
  const angleRad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

function toPolygonString(points: RadarPoint[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function anchorFor(x: number): 'start' | 'middle' | 'end' {
  if (Math.abs(x - CENTER) < 1) return 'middle';
  return x > CENTER ? 'start' : 'end';
}

export function buildSkillRadar(scores: (number | null)[], labels: string[]): RadarGeometry {
  const count = scores.length;

  const valuePoints = scores.map((score, i) => {
    const radius = score === null ? 0 : (Math.max(0, Math.min(score, MAX_SCORE)) / MAX_SCORE) * MAX_RADIUS;
    return pointAt(angleForIndex(i, count), radius);
  });

  const gridPolygons = GRID_LEVELS.map((level) =>
    toPolygonString(Array.from({ length: count }, (_, i) => pointAt(angleForIndex(i, count), (level / MAX_SCORE) * MAX_RADIUS)))
  );

  const axisLines = Array.from({ length: count }, (_, i) => pointAt(angleForIndex(i, count), MAX_RADIUS));

  const axisLabels = labels.map((label, i) => {
    const { x, y } = pointAt(angleForIndex(i, count), LABEL_RADIUS);
    return { label, x, y, textAnchor: anchorFor(x) };
  });

  return {
    size: SIZE,
    center: CENTER,
    maxRadius: MAX_RADIUS,
    valuePoints,
    polygonPoints: toPolygonString(valuePoints),
    gridPolygons,
    axisLines,
    axisLabels,
  };
}
