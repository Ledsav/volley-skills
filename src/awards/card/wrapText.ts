// src/awards/card/wrapText.ts
import { FAMILY } from './type';

/** Greedy word wrap at the context's current font. */
export function wrapLines(ctx: CanvasRenderingContext2D, s: string, maxWidth: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest size ≤ maxSize (down to 40% of it) at which `s` fits on one line. Leaves ctx.font set to it. */
export function fitFontSize(ctx: CanvasRenderingContext2D, s: string, weight: number, maxSize: number, maxWidth: number): number {
  const min = Math.ceil(maxSize * 0.4);
  let size = maxSize;
  for (;;) {
    ctx.font = `${weight} ${size}px ${FAMILY}`;
    if (size <= min || ctx.measureText(s).width <= maxWidth) return size;
    size = Math.max(min, Math.floor(size * 0.9));
  }
}

/** Cuts `s` with an ellipsis until it fits `maxWidth` at the context's current font. */
function ellipsize(ctx: CanvasRenderingContext2D, s: string, maxWidth: number): string {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let cut = s;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1).trimEnd();
  return `${cut}…`;
}

/**
 * Fits text into at most `maxLines` lines of `maxWidth`: the largest size (down to 40%) where the
 * wrapped text fits; at the smallest size the last line (and any overlong word) gets an ellipsis.
 * Every returned line fits. Leaves ctx.font set to the returned size.
 */
export function fitBlock(
  ctx: CanvasRenderingContext2D, s: string, weight: number, maxSize: number, maxWidth: number, maxLines: number,
): { size: number; lines: string[] } {
  const min = Math.ceil(maxSize * 0.4);
  let size = maxSize;
  for (;;) {
    ctx.font = `${weight} ${size}px ${FAMILY}`;
    const lines = wrapLines(ctx, s, maxWidth);
    const fits = lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth);
    if (fits) return { size, lines };
    if (size <= min) {
      const kept = lines.slice(0, maxLines);
      if (lines.length > maxLines) kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
      return { size, lines: kept.map((l) => ellipsize(ctx, l, maxWidth)) };
    }
    size = Math.max(min, Math.floor(size * 0.9));
  }
}

/** One line of text at (x, y) with the given alignment; nothing when alpha ≤ 0. */
export function textAt(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, alpha: number, align: CanvasTextAlign = 'left', letterSpacing = 0,
) {
  if (alpha <= 0 || !s) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (letterSpacing !== 0 && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/**
 * Text with every digit in a fixed-width cell (Inter's proportional digits would make a counting
 * number jitter). Spacing is manual, so ctx.letterSpacing is never set.
 */
export function fillTabular(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, alpha: number,
  align: 'left' | 'center' | 'right', letterSpacing = 0,
): void {
  if (alpha <= 0 || !s) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const cell = ctx.measureText('0').width + letterSpacing;
  const chars = Array.from(s);
  const adv = chars.map((ch) => (/\d/.test(ch) ? cell : ctx.measureText(ch).width + letterSpacing));
  const total = adv.reduce((a, b) => a + b, 0);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  chars.forEach((ch, i) => {
    if (/\d/.test(ch)) {
      ctx.textAlign = 'center';
      ctx.fillText(ch, cx + adv[i] / 2, y);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(ch, cx, y);
    }
    cx += adv[i];
  });
  ctx.restore();
}
