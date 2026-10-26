import type { DvwSide, DvwTeam } from './types';

/** Lowercased words without accents or punctuation. */
function tokens(name: string): Set<string> {
  const plain = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  return new Set(plain.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

/**
 * Which file team is ours: the one whose name shares more words with the app's
 * names (team name, age group, …). A tie or no match picks home.
 */
export function pickOurSide(teams: Record<DvwSide, DvwTeam>, appNames: string[]): DvwSide {
  const app = new Set(appNames.flatMap((n) => [...tokens(n)]));
  const overlap = (side: DvwSide) => [...tokens(teams[side].name)].filter((t) => app.has(t)).length;
  return overlap('a') > overlap('*') ? 'a' : '*';
}
