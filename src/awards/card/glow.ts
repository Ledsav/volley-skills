// src/awards/card/glow.ts

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
