// src/awards/card/wrapText.ts
const FAMILY = 'Inter, system-ui, sans-serif';

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
