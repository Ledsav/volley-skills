/** Where a release at `velocity` (px/s) would come to rest, as a distance (Apple's `project`). */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance past an edge: follows the finger at first, then gives less and less, never reaching `overshoot`. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  if (overshoot <= 0) return 0;
  return (1 - 1 / ((overshoot * constant) / dimension + 1)) * dimension;
}

/** The point closest to `x`. */
export function nearest(points: number[], x: number): number {
  return points.reduce((best, p) => (Math.abs(p - x) < Math.abs(best - x) ? p : best), points[0]);
}
