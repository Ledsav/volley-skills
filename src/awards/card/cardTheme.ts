export interface CardTheme { id: string; label: string; bgFrom: string; bgTo: string; accent: string; text: string; muted: string }

export const PRESETS: CardTheme[] = [
  { id: 'navy', label: 'VCB Navy', bgFrom: '#1C4586', bgTo: '#0B1B36', accent: '#F97316', text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)' },
  { id: 'gold', label: 'Gold Night', bgFrom: '#1A1A1A', bgTo: '#3A2A05', accent: '#F5C542', text: '#FFFFFF', muted: 'rgba(255,255,255,0.75)' },
  { id: 'court', label: 'Court Orange', bgFrom: '#F97316', bgTo: '#B4410B', accent: '#FFFFFF', text: '#FFFFFF', muted: 'rgba(255,255,255,0.8)' },
  { id: 'light', label: 'Clean Light', bgFrom: '#F8FAFC', bgTo: '#E2E8F0', accent: '#2356A8', text: '#0F172A', muted: '#475569' },
];

export interface ThemePrefs { presetId: string; custom: { from: string; to: string } | null }
const KEY = 'vcb.awards.theme';
const DEFAULT: ThemePrefs = { presetId: 'navy', custom: null };
const HEX = /^#[0-9a-fA-F]{6}$/;

export function readThemePrefs(): ThemePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ThemePrefs> | null;
    if (!raw || !PRESETS.some((t) => t.id === raw.presetId)) return DEFAULT;
    const c = raw.custom;
    const custom = c && HEX.test(c.from) && HEX.test(c.to) ? { from: c.from, to: c.to } : null;
    if (c && !custom) return DEFAULT;
    return { presetId: raw.presetId!, custom };
  } catch {
    return DEFAULT;
  }
}

export function writeThemePrefs(p: ThemePrefs): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* per-device convenience only */ }
}

export function themeFromPrefs(p: ThemePrefs): CardTheme {
  const base = PRESETS.find((t) => t.id === p.presetId) ?? PRESETS[0];
  return p.custom ? { ...base, bgFrom: p.custom.from, bgTo: p.custom.to } : base;
}
