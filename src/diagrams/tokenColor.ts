import { PALETTE_COLORS, type PaletteColor } from '../types/diagram';

const KNOWN = new Set<string>(PALETTE_COLORS);

function resolve(name: PaletteColor | string): string {
  return KNOWN.has(name) ? name : 'ink';
}

export function tokenColor(name: PaletteColor | string): string {
  return `rgb(var(--color-${resolve(name)}))`;
}

export function tokenColorAlpha(name: PaletteColor | string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  return `rgb(var(--color-${resolve(name)}) / ${a})`;
}
