// src/awards/card/glow.ts
import { contrast } from '../palette';

/** '#RRGGBB' plus an alpha (clamped 0–1) as '#RRGGBBAA'. */
export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  return `${hex}${a.toString(16).padStart(2, '0').toUpperCase()}`;
}

/** A soft radial glow: `color` at `alpha` in the centre fading to nothing at `radius`. */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha: number): void {
  if (alpha <= 0 || radius <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, hexAlpha(color, alpha));
  g.addColorStop(1, hexAlpha(color, 0));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('');
}

/** True when `text` still reads (contrast at least 4.5) on `bg` blended with a glow of `alpha` at its brightest. */
export function readableOverGlow(bg: string, accent: string, text: string, alpha: number): boolean {
  return contrast(mix(bg, accent, Math.max(0, Math.min(1, alpha))), text) >= 4.5;
}
