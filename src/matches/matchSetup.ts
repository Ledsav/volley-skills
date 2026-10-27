import type { LiberoConfig, MatchSetupInput, RosterEntry } from '../types/match';
import type { Player, PositionCategory } from '../types/player';
import { getT } from '../i18n/I18nProvider';

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

/** `role` is the per-match role (defaults to the profile position); the profile itself is never changed. */
export function buildRoster(
  players: Player[],
  picks: Record<string, { checked: boolean; number: number; role?: PositionCategory }>,
): RosterEntry[] {
  return players
    .filter((p) => picks[p.id]?.checked)
    .sort((a, b) => Number(b.starting) - Number(a.starting) || picks[a.id].number - picks[b.id].number)
    .map((p) => ({
      playerId: p.id,
      number: picks[p.id].number,
      name: p.fullName,
      positionCategory: picks[p.id].role ?? p.positionCategory,
    }));
}

/** Why a setup cannot be saved; the UI maps the code to text (`setupProblemMessage`). */
export type SetupProblem =
  | { code: 'noDate' }
  | { code: 'noOpponent' }
  | { code: 'tooManyLiberos' }
  | { code: 'liberoTwice' }
  | { code: 'liberoNotInRoster' }
  | { code: 'tooFewPlayers' }
  | { code: 'rosterTooLarge'; max: number }
  | { code: 'badNumber'; name: string }
  | { code: 'duplicateNumber'; number: number }
  | { code: 'badFormat' };

/** The text for a setup problem, in the active language. */
export function setupProblemMessage(problem: SetupProblem): string {
  const p = getT().matches.setup.problem;
  switch (problem.code) {
    case 'rosterTooLarge':
      return p.rosterTooLarge(problem.max);
    case 'badNumber':
      return p.badNumber(problem.name);
    case 'duplicateNumber':
      return p.duplicateNumber(problem.number);
    default:
      return p[problem.code];
  }
}

export function validateSetup(input: MatchSetupInput): SetupProblem | null {
  if (!input.date) return { code: 'noDate' };
  if (!input.opponent.trim()) return { code: 'noOpponent' };
  const liberoIds = new Set(input.liberos.map((l) => l.playerId));
  if (input.liberos.length > 2) return { code: 'tooManyLiberos' };
  if (liberoIds.size < input.liberos.length) return { code: 'liberoTwice' };
  if (input.liberos.some((l) => !input.roster.some((r) => r.playerId === l.playerId))) {
    return { code: 'liberoNotInRoster' };
  }
  if (input.roster.filter((r) => !liberoIds.has(r.playerId)).length < 6) {
    return { code: 'tooFewPlayers' };
  }
  if (input.roster.length > MAX_ROSTER) return { code: 'rosterTooLarge', max: MAX_ROSTER };
  const seen = new Set<number>();
  for (const r of input.roster) {
    if (!Number.isInteger(r.number) || r.number < 1 || r.number > 99) return { code: 'badNumber', name: r.name };
    if (seen.has(r.number)) return { code: 'duplicateNumber', number: r.number };
    seen.add(r.number);
  }
  const f = input.format;
  if ([f.setPoints, f.decidingSetPoints, f.subsPerSet, f.timeoutsPerSet].some((v) => !Number.isFinite(v) || v < 0) || f.setPoints < 1) {
    return { code: 'badFormat' };
  }
  return null;
}

export function defaultLineup(roster: RosterEntry[], liberos: LiberoConfig[]): string[] {
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  return roster.filter((r) => !liberoIds.has(r.playerId)).slice(0, 6).map((r) => r.playerId);
}
