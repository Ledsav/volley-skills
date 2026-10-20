import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bbox, DiagramSvg } from '../../diagrams/DiagramSvg';
import type { Scene } from '../../types/diagram';

/** The light-theme `--color-*` values from `:root` in src/index.css. A PDF has no CSS, so they're inlined. */
export const LIGHT_TOKENS: Record<string, [number, number, number]> = {
  navy: [35, 86, 168],
  blue: [40, 101, 246],
  'blue-strong': [30, 79, 220],
  orange: [249, 115, 22],
  'orange-strong': [194, 65, 12],
  green: [16, 152, 97],
  'green-strong': [12, 124, 79],
  red: [220, 38, 38],
  'red-strong': [185, 28, 28],
  ink: [15, 23, 42],
  slate: [100, 116, 139],
  border: [226, 232, 240],
  bg: [248, 250, 252],
  surface: [255, 255, 255],
};

/** `rgb(var(--color-x))` → `rgb(r,g,b)`; `rgb(var(--color-x) / a)` → `rgba(r,g,b,a)`. */
export function resolveThemeColors(svg: string): string {
  return svg.replace(/rgb\(var\(--color-([a-z-]+)\)(?:\s*\/\s*([\d.]+))?\)/g, (_, name: string, alpha?: string) => {
    const [r, g, b] = LIGHT_TOKENS[name] ?? LIGHT_TOKENS.ink;
    return alpha === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
  });
}

// A half court spans y 6–72 of the square canvas (CourtBackdrop); below that is usually empty.
const HALF_COURT_BOTTOM = 78;

/** Canvas height to print: a half court is cropped below the court, but never above an item. */
function printHeight(scene: Scene): number {
  if (scene.court !== 'half') return 100;
  const lowest = Math.max(0, ...scene.items.map((i) => { const b = bbox(i); return b.y + b.h; }));
  return Math.min(100, Math.max(HALF_COURT_BOTTOM, Math.ceil(lowest + 2)));
}

/** A court diagram as a standalone, CSS-free SVG string (always light colours). */
export function diagramToPdfSvg(scene: Scene): string {
  const height = printHeight(scene);
  const markup = resolveThemeColors(renderToStaticMarkup(createElement(DiagramSvg, { scene })))
    .replace('viewBox="0 0 100 100"', `viewBox="0 0 100 ${height}"`)
    .replace(/^<svg\s(?:width="[^"]*"\s+height="[^"]*"\s+)?/, `<svg width="100" height="${height}" `);
  return markup;
}
