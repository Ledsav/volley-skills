import type { PositionCategory } from '../types/player';
import { SKILLS, type ActionEvent, type Side, type Skill, type SkillCounts } from '../types/match';
import type { MatchState } from './scoutEngine';

const LIBERO_FORBIDDEN: Skill[] = ['S', 'A', 'B'];

const POSITION_DEFAULTS: Partial<Record<PositionCategory, Skill[]>> = {
  S: ['E', 'S', 'D', 'B', 'A'],
  L: ['R', 'D', 'F', 'E'],
  MB: ['B', 'A', 'S', 'D'],
  OH: ['R', 'A', 'S', 'D', 'B'],
  O: ['A', 'B', 'S', 'D'],
};
const GENERIC_DEFAULT: Skill[] = ['S', 'R', 'A', 'B', 'D', 'E'];

const NEXT_AFTER: Record<Skill, Skill> = {
  S: 'B',
  R: 'E',
  E: 'A',
  A: 'B',
  B: 'D',
  D: 'E',
  F: 'E',
};

export function expectedSkill(state: { currentRally: ActionEvent[]; serving: Side }): Skill {
  const last = state.currentRally[state.currentRally.length - 1];
  if (!last) return state.serving === 'us' ? 'S' : 'R';
  return NEXT_AFTER[last.skill];
}

export function countsForPlayer(state: Pick<MatchState, 'actions'>, playerId: string): SkillCounts {
  const counts: SkillCounts = {};
  for (const a of state.actions) {
    if (a.playerId === playerId) counts[a.skill] = (counts[a.skill] ?? 0) + 1;
  }
  return counts;
}

function total(counts: SkillCounts): number {
  return Object.values(counts).reduce((sum, v) => sum + (v ?? 0), 0);
}

export function orderSkills(args: {
  position: PositionCategory;
  isLibero: boolean;
  expected: Skill;
  matchCounts: SkillCounts;
  history: { matches: number; totals: SkillCounts } | null;
}): Skill[] {
  const { position, isLibero, expected, matchCounts, history } = args;
  const allowed = SKILLS.filter((s) => !(isLibero && LIBERO_FORBIDDEN.includes(s)));
  const defaults = POSITION_DEFAULTS[isLibero ? 'L' : position] ?? GENERIC_DEFAULT;
  const defaultRank = (s: Skill) => {
    const i = defaults.indexOf(s);
    return i >= 0 ? i : defaults.length + SKILLS.indexOf(s);
  };

  let weight: (s: Skill) => number = () => 0;
  if (total(matchCounts) > 0) {
    weight = (s) => matchCounts[s] ?? 0;
  } else if (history && history.matches > 0) {
    weight = (s) => (history.totals[s] ?? 0) / history.matches;
  }

  const ranked = [...allowed].sort((a, b) => weight(b) - weight(a) || defaultRank(a) - defaultRank(b));
  if (!allowed.includes(expected)) return ranked;
  return [expected, ...ranked.filter((s) => s !== expected)];
}
