import type { SearchGroupId } from './types';

export const RECENTS_KEY = 'vcb.searchRecents';
const MAX_RECENTS = 8;

export interface Recent {
  id: string;
  group: SearchGroupId;
  label: string;
  sublabel?: string;
  to: string;
}

/** Recents live in sessionStorage only: they name people and are gone with the tab. */
export function readRecents(): Recent[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Recent[]).slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

/** Newest first, deduped by id, at most 8. */
export function pushRecent(r: Recent): void {
  try {
    const next = [r, ...readRecents().filter((x) => x.id !== r.id)].slice(0, MAX_RECENTS);
    sessionStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents are a convenience
  }
}

export function clearRecents(): void {
  try {
    sessionStorage.removeItem(RECENTS_KEY);
  } catch {
    // storage unavailable
  }
}
