import type { Match, PlayerStats, RosterEntry } from '../types/match';
import type { TestingSessionEntry } from '../types/testingSession';

/**
 * Name shown in old match reports for a player whose data was erased. The
 * roster entry stays (with an id nothing points to any more) so the match's
 * team totals and timeline still replay.
 */
export const REMOVED_PLAYER_NAME = 'Removed player';

/** One of the player's entries in a physical-testing session draft. */
export interface PlayerTestingEntry {
  sessionId: string;
  sessionDate: string;
  entry: TestingSessionEntry;
}

/** What a match holds about one player: their roster snapshot and their stats. */
export interface PlayerMatchRecord {
  matchId: string;
  date: string;
  opponent: string;
  competition: string;
  homeAway: string;
  status: string;
  rosterEntry: RosterEntry;
  libero: boolean;
  /** Whole-match stats from the saved report (or summary); null while unfinished. */
  stats: PlayerStats | null;
  statsBySet: Record<number, PlayerStats>;
}

/** Everything about a player stored outside their own player doc. */
export interface PlayerFootprint {
  testingEntries: PlayerTestingEntry[];
  matches: PlayerMatchRecord[];
}

export const EMPTY_FOOTPRINT: PlayerFootprint = { testingEntries: [], matches: [] };

export function rosterHasPlayer(match: Pick<Match, 'roster'>, playerId: string): boolean {
  return (match.roster ?? []).some((r) => r.playerId === playerId);
}

/** Strips the name and jersey number from the player's roster entry. */
export function anonymizeRoster(roster: RosterEntry[], playerId: string): RosterEntry[] {
  return roster.map((r) => (r.playerId === playerId ? { ...r, name: REMOVED_PLAYER_NAME, number: 0 } : r));
}

export function playerMatchRecord(match: Match, playerId: string): PlayerMatchRecord | null {
  const rosterEntry = (match.roster ?? []).find((r) => r.playerId === playerId);
  if (!rosterEntry) return null;
  const statsBySet: Record<number, PlayerStats> = {};
  for (const [set, stats] of Object.entries(match.report?.bySet ?? {})) {
    const line = stats.players[playerId];
    if (line) statsBySet[Number(set)] = line;
  }
  return {
    matchId: match.id,
    date: match.date,
    opponent: match.opponent,
    competition: match.competition,
    homeAway: match.homeAway,
    status: match.status,
    rosterEntry,
    libero: (match.liberos ?? []).some((l) => l.playerId === playerId),
    stats: match.report?.all.players[playerId] ?? match.summary?.players[playerId] ?? null,
    statsBySet,
  };
}
