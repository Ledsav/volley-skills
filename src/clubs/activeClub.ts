import type { Membership } from '../types/club';

export const ACTIVE_CLUB_KEY = 'vcb.activeClub';

/**
 * The club to open: the stored one while it is still a usable membership,
 * otherwise the first by name. `dropped` flags a stored club that was let go.
 */
export function pickActiveClub(
  memberships: Membership[],
  stored: string | null,
): { clubId: string | null; dropped: boolean } {
  const usable = memberships.filter((m) => m.status !== 'deleted');
  const kept = usable.find((m) => m.clubId === stored);
  const clubId = kept
    ? kept.clubId
    : [...usable].sort((a, b) => a.clubName.localeCompare(b.clubName))[0]?.clubId ?? null;
  return { clubId, dropped: stored !== null && stored !== clubId };
}

export function readStoredClub(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CLUB_KEY);
  } catch {
    return null;
  }
}

export function storeClub(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_CLUB_KEY, id);
    else localStorage.removeItem(ACTIVE_CLUB_KEY);
  } catch {
    // Storage blocked (private mode): the choice lasts for this page only.
  }
}
