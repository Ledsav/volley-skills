import type { ExerciseCategory } from '../types/exercise';

/** True only when both numbers are known and the drill needs more players than suggested. */
export function needsMorePlayers(minPlayers: number | undefined, suggested: number | null): boolean {
  return minPlayers !== undefined && suggested !== null && minPlayers > suggested;
}

/** Stable: drills that need more players than suggested go after the rest; nothing is removed. */
export function sortByFit<T extends { minPlayers?: number }>(items: T[], suggested: number | null): T[] {
  if (suggested === null) return items;
  const fits = items.filter((i) => !needsMorePlayers(i.minPlayers, suggested));
  const short = items.filter((i) => needsMorePlayers(i.minPlayers, suggested));
  return [...fits, ...short];
}

export function coveredTargets(
  targets: ExerciseCategory[],
  rows: { category?: ExerciseCategory }[],
): Set<ExerciseCategory> {
  const present = new Set(rows.map((r) => r.category));
  return new Set(targets.filter((t) => present.has(t)));
}
