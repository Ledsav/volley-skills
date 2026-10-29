import type { SearchGroupId } from './types';

export const RECENTS_KEY = 'vcb.searchRecents';
const MAX_RECENTS = 8;

/** The key the session search cache and the recents share: the club and the person. */
export function searchKey(clubId: string | null | undefined, email: string | null | undefined): string {
  return `${clubId ?? ''}|${email ?? ''}`;
}

export interface Recent {
  id: string;
  group: SearchGroupId;
  label: string;
  sublabel?: string;
  to: string;
}

interface Stored {
  /** `${clubId}|${email}`, the same key as the search cache. */
  key: string;
  items: Recent[];
}

/** Recents live in sessionStorage only: they name people and are gone with the tab. Keyed by club and person (the search cache's key), so neither a club switch nor a new sign-in shows another's. */
export function readRecents(key: string): Recent[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    const stored = (raw ? JSON.parse(raw) : null) as Partial<Stored> | null;
    if (!stored || typeof stored !== 'object' || !Array.isArray(stored.items)) return [];
    if (stored.key !== key) {
      sessionStorage.removeItem(RECENTS_KEY);
      return [];
    }
    return stored.items
      .filter(
        (r): r is Recent =>
          !!r && typeof r.id === 'string' && typeof r.label === 'string' && typeof r.to === 'string' && typeof r.group === 'string',
      )
      .slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Newest first, deduped by id, at most 8; another key's list is discarded. */
export function pushRecent(key: string, r: Recent): void {
  try {
    const next: Stored = { key, items: [r, ...readRecents(key).filter((x) => x.id !== r.id)].slice(0, MAX_RECENTS) };
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
