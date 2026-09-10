import type { Player, PositionCategory } from '../types/player';
import { ageFromDob } from './age';

export type RosterSort = 'number' | 'skill' | 'lineup' | 'age';

// Lineup order: specialist roles first, then unassigned, and finally "universal"
// (an all-round player with no fixed position) dead last.
const POSITION_RANK: Record<PositionCategory, number> = {
  S: 0,
  OH: 1,
  O: 2,
  MB: 3,
  L: 4,
  TBD: 5,
  U: 6,
};

/** Lineup order for a position; an unknown or missing category sorts as TBD. */
export function positionRank(category: PositionCategory | null | undefined): number {
  if (!category) return POSITION_RANK.TBD;
  return POSITION_RANK[category] ?? POSITION_RANK.TBD;
}

/**
 * Case-insensitive substring match over the fields a coach would scan for:
 * name, position-category code, and shirt number.
 */
export function filterRoster(players: Player[], search: string): Player[] {
  const q = search.trim().toLowerCase();
  if (q === '') return players;
  return players.filter(
    (p) =>
      p.fullName.toLowerCase().includes(q) ||
      (p.positionCategory ?? '').toLowerCase().includes(q) ||
      String(p.number).includes(q)
  );
}

function bySkillDesc(a: Player, b: Player): number {
  const av = a.avgScore ?? null;
  const bv = b.avgScore ?? null;
  if (av === bv) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return bv - av;
}

// Oldest player first; anyone without a usable date of birth sorts last.
function byAgeDesc(a: Player, b: Player): number {
  const av = ageFromDob(a.dob ?? '');
  const bv = ageFromDob(b.dob ?? '');
  if (av === bv) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  return bv - av;
}

// Shirt numbers aren't always assigned yet (seeded as 0), so fall back to a
// stable alphabetical order rather than Firestore document order.
function byNumberThenName(a: Player, b: Player): number {
  if (a.number && b.number && a.number !== b.number) return a.number - b.number;
  if (Boolean(a.number) !== Boolean(b.number)) return a.number ? -1 : 1;
  return a.fullName.localeCompare(b.fullName);
}

/** Returns a new, sorted array — never mutates the input. */
export function sortRoster(players: Player[], sort: RosterSort): Player[] {
  const copy = [...players];
  switch (sort) {
    case 'skill':
      return copy.sort((a, b) => bySkillDesc(a, b) || byNumberThenName(a, b));
    case 'age':
      return copy.sort((a, b) => byAgeDesc(a, b) || byNumberThenName(a, b));
    case 'lineup':
      return copy.sort(
        (a, b) =>
          Number(b.starting === true) - Number(a.starting === true) ||
          positionRank(a.positionCategory) - positionRank(b.positionCategory) ||
          byNumberThenName(a, b)
      );
    case 'number':
    default:
      return copy.sort(byNumberThenName);
  }
}
