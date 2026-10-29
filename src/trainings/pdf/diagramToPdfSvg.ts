import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { bbox, DiagramSvg } from '../../diagrams/DiagramSvg';
import type { Scene } from '../../types/diagram';

/** The light-theme `--color-*` values from `:root` in src/index.css. A PDF has no CSS, so they're inlined. */
export const LIGHT_TOKENS: Record<string, [number, number, number]> = {
  navy: [35, 86, 168],
  bg: [245, 245, 247],
  surface: [255, 255, 255],
  'surface-2': [242, 242, 247],
  'surface-3': [229, 229, 234],
  ink: [29, 29, 31],
  'ink-2': [110, 110, 115],
  'ink-3': [142, 142, 147],
  separator: [222, 222, 224],
  slate: [110, 110, 115],
  border: [222, 222, 224],
  red: [255, 59, 48],
  'red-strong': [205, 0, 20],
  orange: [255, 149, 0],
  'orange-strong': [201, 52, 0],
  blue: [0, 122, 255],
  'blue-strong': [0, 64, 221],
  green: [52, 199, 89],
  'green-strong': [30, 125, 55],
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
