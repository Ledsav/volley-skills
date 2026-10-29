const KEY = 'vcb.teamsFilter';

export type TeamsFilter = 'mine' | 'all';

/** Which teams a club admin lists: only the ones they are on, or every club team. Defaults to all. */
export function readTeamsFilter(): TeamsFilter {
  try {
    return localStorage.getItem(KEY) === 'mine' ? 'mine' : 'all';
  } catch {
    return 'all';
  }
}

export function writeTeamsFilter(filter: TeamsFilter): void {
  try {
    localStorage.setItem(KEY, filter);
  } catch {
    /* per-device convenience only */
  }
}
