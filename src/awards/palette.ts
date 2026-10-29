// src/awards/palette.ts
/**
 * Award-story palettes: 4–5 colours that rotate slide by slide (Wrapped-style).
 * Text colour is chosen per slide for contrast, so any palette stays readable.
 */
export interface Palette { id: string; name: string; colors: string[] }
export interface SlideColors { bg: string; accent: string; text: string; muted: string }

export const MIN_COLORS = 4;
export const MAX_COLORS = 5;
const HEX = /^#[0-9a-fA-F]{6}$/;
const WHITE = '#FFFFFF';
const INK = '#0F172A';

export const PRESET_PALETTES: Palette[] = [
  { id: 'night', name: 'Night', colors: ['#000000', '#000000', '#000000', '#000000'] },
  { id: 'navy', name: 'Navy', colors: ['#1C4586', '#0B1B36', '#F97316', '#2865F6', '#F5C542'] },
  { id: 'gold', name: 'Gold Night', colors: ['#1A1A1A', '#3A2A05', '#F5C542', '#7A5A10', '#FFFFFF'] },
  { id: 'court', name: 'Court Orange', colors: ['#C2410C', '#7C2D12', '#FFFFFF', '#1C4586', '#FDBA74'] },
  { id: 'light', name: 'Clean Light', colors: ['#F8FAFC', '#E2E8F0', '#2356A8', '#C2410C', '#0F172A'] },
  { id: 'wrapped', name: 'Wrapped', colors: ['#1ED760', '#FF4FA3', '#5B2EFF', '#FF7A1A', '#121212'] },
];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function slideColors(p: Palette, i: number): SlideColors {
  const n = p.colors.length;
  const k = ((i % n) + n) % n;
  const bg = p.colors[k];
  const text = contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK;
  const candidate = p.colors[(k + 2) % n];
  const accent = contrast(bg, candidate) >= 3 ? candidate : text;
  const muted = text === WHITE ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';
  return { bg, accent, text, muted };
}

export function isValidPalette(x: unknown): x is Palette {
  if (!x || typeof x !== 'object') return false;
  const p = x as Partial<Palette>;
  return typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.colors)
    && p.colors.length >= MIN_COLORS && p.colors.length <= MAX_COLORS && p.colors.every((c) => typeof c === 'string' && HEX.test(c));
}

export interface PalettePrefs { selectedId: string; custom: Palette[] }

const LIST_KEY = 'vcb.awards.palettes';
const SELECTED_KEY = 'vcb.awards.palette';
const OLD_THEME_KEY = 'vcb.awards.theme';

export function newPaletteId(): string {
  return `custom-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function migrateOldTheme(): PalettePrefs | null {
  const raw = JSON.parse(localStorage.getItem(OLD_THEME_KEY) ?? 'null') as { presetId?: string; custom?: { from?: string; to?: string } | null } | null;
  if (!raw) return null;
  const base = PRESET_PALETTES.find((p) => p.id === raw.presetId) ?? PRESET_PALETTES.find((p) => p.id === 'navy')!;
  const c = raw.custom;
  if (c && typeof c.from === 'string' && typeof c.to === 'string' && HEX.test(c.from) && HEX.test(c.to)) {
    const migrated: Palette = { id: newPaletteId(), name: 'My colours', colors: [c.from, c.to, ...base.colors.slice(2)].slice(0, MAX_COLORS) };
    return { selectedId: migrated.id, custom: [migrated] };
  }
  return { selectedId: base.id, custom: [] };
}

export function readPalettePrefs(): PalettePrefs {
  const fallback: PalettePrefs = { selectedId: PRESET_PALETTES[0].id, custom: [] };
  try {
    const list = localStorage.getItem(LIST_KEY);
    const selected = localStorage.getItem(SELECTED_KEY);
    if (list === null && selected === null) return migrateOldTheme() ?? fallback;
    const parsed: unknown = JSON.parse(list ?? '[]');
    const custom = Array.isArray(parsed) ? parsed.filter(isValidPalette) : [];
    const prefs = { selectedId: selected ?? fallback.selectedId, custom };
    return allPalettes(prefs).some((p) => p.id === prefs.selectedId) ? prefs : { ...prefs, selectedId: fallback.selectedId };
  } catch {
    return fallback;
  }
}

export function writePalettePrefs(p: PalettePrefs): void {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(p.custom));
    localStorage.setItem(SELECTED_KEY, p.selectedId);
  } catch { /* per-device convenience only */ }
}

export function allPalettes(p: PalettePrefs): Palette[] {
  return [...PRESET_PALETTES, ...p.custom];
}

export function selectedPalette(p: PalettePrefs): Palette {
  return allPalettes(p).find((x) => x.id === p.selectedId) ?? PRESET_PALETTES.find((p) => p.id === 'navy')!;
}
