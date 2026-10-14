import type { Person } from '../teams/stats/rosterIndex';

export type NameStyle = 'full' | 'firstInitial' | 'first' | 'number';
export const NAME_STYLE_LABELS: Record<NameStyle, string> = {
  full: 'Full name', firstInitial: 'First name + initial', first: 'First name', number: 'Number only',
};
const KEY = 'vcb.awards.nameStyle';
const STYLES = Object.keys(NAME_STYLE_LABELS) as NameStyle[];

export function styleName(p: Person, style: NameStyle): string {
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? p.name.trim();
  if (style === 'number' && p.number !== null) return `#${p.number}`;
  if (style === 'full') return parts.join(' ');
  if (style === 'first') return first;
  return parts.length > 1 ? `${first} ${parts[1].charAt(0)}.` : first;
}

export function readNameStyle(): NameStyle {
  try {
    const v = localStorage.getItem(KEY);
    return STYLES.includes(v as NameStyle) ? (v as NameStyle) : 'firstInitial';
  } catch {
    return 'firstInitial';
  }
}

export function writeNameStyle(s: NameStyle): void {
  try { localStorage.setItem(KEY, s); } catch { /* per-device convenience only */ }
}
