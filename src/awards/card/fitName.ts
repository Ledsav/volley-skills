const ELLIPSIS = '…';

function setSize(ctx: CanvasRenderingContext2D, size: number) {
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + ELLIPSIS).width > maxWidth) s = s.slice(0, -1);
  return s.trimEnd() + ELLIPSIS;
}

/** Shrink from maxSize to minSize; if still too wide, wrap to 2 lines at minSize; then ellipsis. */
export function fitName(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxSize = 120, minSize = 64) {
  const clean = text.trim().replace(/\s+/g, ' ');
  for (let size = maxSize; size >= minSize; size -= 4) {
    setSize(ctx, size);
    if (ctx.measureText(clean).width <= maxWidth) return { size, lines: [clean] };
  }
  setSize(ctx, minSize);
  const words = clean.split(' ');
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (ctx.measureText(next).width > maxWidth) break;
    first = next;
  }
  if (!first) return { size: minSize, lines: [truncate(ctx, clean, maxWidth)] }; // one unbreakable token
  const rest = words.slice(i).join(' ');
  return { size: minSize, lines: rest ? [first, truncate(ctx, rest, maxWidth)] : [first] };
}
