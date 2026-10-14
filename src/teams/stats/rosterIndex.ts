import type { Match } from '../../types/match';
import type { Player } from '../../types/player';

export interface Person { playerId: string; name: string; number: number | null; current: boolean }

export const UNKNOWN_PERSON = (playerId: string): Person => ({ playerId, name: 'Unknown player', number: null, current: false });

/** Name/number per player from the newest match roster that lists them (survives number changes and departures). */
export function latestRosterIndex(matches: Match[]): Map<string, Person> {
  const out = new Map<string, Person>();
  for (const m of [...matches].sort((a, b) => b.date.localeCompare(a.date))) {
    for (const r of m.roster) {
      if (!out.has(r.playerId)) out.set(r.playerId, { playerId: r.playerId, name: r.name, number: r.number, current: false });
    }
  }
  return out;
}

/** Marks current team players and adds the ones who never played (for award pickers). */
export function withCurrentRoster(index: Map<string, Person>, players: Player[]): Map<string, Person> {
  const out = new Map(index);
  for (const p of players) {
    const known = out.get(p.id);
    out.set(p.id, known ? { ...known, current: true } : { playerId: p.id, name: p.fullName, number: p.number, current: true });
  }
  return out;
}
