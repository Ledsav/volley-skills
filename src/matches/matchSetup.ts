import type { LiberoConfig, MatchSetupInput, RosterEntry } from '../types/match';
import type { Player } from '../types/player';

export const MAX_ROSTER = 14;

/** Default ticks: starters first, then the liberos (L), then the rest by number — at most MAX_ROSTER. */
export function defaultRosterIds(players: Player[]): string[] {
  const byNumber = (a: Player, b: Player) => a.number - b.number;
  const isL = (p: Player) => p.positionCategory === 'L';
  const starters = players.filter((p) => p.starting && !isL(p)).sort(byNumber);
  const liberos = players.filter(isL).sort(byNumber).slice(0, 2);
  const rest = players.filter((p) => !p.starting && !isL(p)).sort(byNumber);
  return [...starters, ...liberos, ...rest].slice(0, MAX_ROSTER).map((p) => p.id);
}

export function buildRoster(players: Player[], picks: Record<string, { checked: boolean; number: number }>): RosterEntry[] {
  return players
    .filter((p) => picks[p.id]?.checked)
    .sort((a, b) => Number(b.starting) - Number(a.starting) || picks[a.id].number - picks[b.id].number)
    .map((p) => ({
      playerId: p.id,
      number: picks[p.id].number,
      name: p.fullName,
      positionCategory: p.positionCategory,
    }));
}

export function validateSetup(input: MatchSetupInput): string | null {
  if (!input.date) return 'Pick a date.';
  if (!input.opponent.trim()) return 'Enter the opponent.';
  const liberoIds = new Set(input.liberos.map((l) => l.playerId));
  if (input.liberos.length > 2) return 'At most two liberos.';
  if (liberoIds.size < input.liberos.length) return 'Pick two different players as liberos.';
  if (input.liberos.some((l) => !input.roster.some((r) => r.playerId === l.playerId))) {
    return 'Each libero must be in the match roster.';
  }
  if (input.roster.filter((r) => !liberoIds.has(r.playerId)).length < 6) {
    return 'Pick at least 6 players besides the libero(s).';
  }
  if (input.roster.length > MAX_ROSTER) return `A match roster has at most ${MAX_ROSTER} players.`;
  const seen = new Set<number>();
  for (const r of input.roster) {
    if (!Number.isInteger(r.number) || r.number < 1 || r.number > 99) return `Check the shirt number for ${r.name}.`;
    if (seen.has(r.number)) return `Two players share #${r.number}.`;
    seen.add(r.number);
  }
  const f = input.format;
  if ([f.setPoints, f.decidingSetPoints, f.subsPerSet, f.timeoutsPerSet].some((v) => !Number.isFinite(v) || v < 0) || f.setPoints < 1) {
    return 'Check the match format numbers.';
  }
  return null;
}

export function defaultLineup(roster: RosterEntry[], liberos: LiberoConfig[]): string[] {
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  return roster.filter((r) => !liberoIds.has(r.playerId)).slice(0, 6).map((r) => r.playerId);
}
