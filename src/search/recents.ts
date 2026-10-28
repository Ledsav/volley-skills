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

interface Stored {
  clubId: string;
  items: Recent[];
}

/** Recents live in sessionStorage only: they name people and are gone with the tab. Keyed by club, so a club switch never shows another club's. */
export function readRecents(clubId: string): Recent[] {
  try {
    const raw = sessionStorage.getItem(RECENTS_KEY);
    const stored = (raw ? JSON.parse(raw) : null) as Partial<Stored> | null;
    if (!stored || typeof stored !== 'object' || !Array.isArray(stored.items)) return [];
    if (stored.clubId !== clubId) {
      sessionStorage.removeItem(RECENTS_KEY);
      return [];
    }
    return stored.items.slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Newest first, deduped by id, at most 8; another club's list is discarded. */
export function pushRecent(clubId: string, r: Recent): void {
  try {
    const next: Stored = { clubId, items: [r, ...readRecents(clubId).filter((x) => x.id !== r.id)].slice(0, MAX_RECENTS) };
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
