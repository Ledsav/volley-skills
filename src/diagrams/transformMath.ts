/**
 * Pure geometry for the selection "dot" that doubles as a resize + rotate
 * handle on a POINT diagram element. The handle sits at a bbox corner; dragging
 * it away from / toward the element centre scales `size`, dragging it around the
 * centre changes `rotation`.
 */

/** Fold any angle in degrees into the half-open range (-180, 180]. */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function computeHandleTransform(args: {
  center: { x: number; y: number };
  /** pointer position (court coords) at drag start */
  start: { x: number; y: number };
  /** pointer position (court coords) now */
  current: { x: number; y: number };
  startSize: number;
  startRotation: number;
  snapRotation: boolean;
}): { size: number; rotation: number } {
  const { center, start, current, startSize, startRotation, snapRotation } = args;

  // Epsilon floor on the start radius so a handle that begins near the centre
  // can't blow the ratio up to Infinity/NaN.
  const d0 = Math.max(Math.hypot(start.x - center.x, start.y - center.y), 1);
  const d = Math.hypot(current.x - center.x, current.y - center.y);
  const size = clamp(startSize * (d / d0), 0.5, 2);

  const a0 = Math.atan2(start.y - center.y, start.x - center.x);
  const a = Math.atan2(current.y - center.y, current.x - center.x);
  const deltaDeg = (a - a0) * (180 / Math.PI);

  let rotation = normalizeDeg(startRotation + deltaDeg);
  if (snapRotation) rotation = normalizeDeg(Math.round(rotation / 15) * 15);

  return { size, rotation };
}
