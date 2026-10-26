import type { PositionCategory } from '../types/player';
import {
  SKILLS,
  type ActionEvent,
  type LiberoConfig,
  type RosterEntry,
  type Side,
  type Skill,
  type SkillCounts,
  type UsageProfile,
} from '../types/match';
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
  // `/` on a pass sends the ball straight over: they attack it, so we block.
  // `/` on a serve is their free ball back: we play it as a free ball.
  if (last.grade === '/') {
    if (last.skill === 'R' || last.skill === 'D' || last.skill === 'F') return 'B';
    if (last.skill === 'S') return 'F';
  }
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

/**
 * Weight of the usage-history prior in `predictPlayer`, spread across the
 * candidates (it sums to PRIOR_WEIGHT). Each action of the skill in this match
 * counts 1, so this match's data dominates after a couple of touches.
 */
const PRIOR_WEIGHT = 2;

/** Who usually performs a skill when there is no data: earlier = more likely. */
const PREDICT_POSITION_RANK: Record<Skill, PositionCategory[]> = {
  S: [],
  R: ['L', 'OH'],
  D: ['L', 'OH'],
  E: ['S'],
  A: ['OH', 'O', 'MB'],
  B: ['MB', 'O', 'OH'],
  F: ['L', 'OH'],
};

/**
 * The most likely on-court player to perform `skill` next, or null when nobody
 * on court can.
 *
 * - Serve while we serve: the player in P1 (deterministic).
 * - Otherwise each candidate scores `matchCount + prior`, where matchCount is
 *   how often they performed the skill this match (all sets) and the prior is
 *   PRIOR_WEIGHT × their share of the candidates' history averages
 *   (totals[skill] / matches) — 0 for everyone when no candidate has history.
 * - Ties (and no data at all): position default for the skill, then the lowest
 *   jersey number.
 * - Liberos are never candidates for S, A or B.
 * - Position = `state.roles` (per-set roles) when given, else the roster role.
 */
export function predictPlayer(args: {
  state: Pick<MatchState, 'court' | 'serving' | 'actions'> & Partial<Pick<MatchState, 'roles'>>;
  skill: Skill;
  roster: ReadonlyMap<string, RosterEntry>;
  liberos: LiberoConfig[];
  usage: UsageProfile;
}): string | null {
  const { state, skill, roster, liberos, usage } = args;
  const liberoIds = new Set(liberos.map((l) => l.playerId));
  const canPerform = (id: string) => roster.has(id) && !(liberoIds.has(id) && LIBERO_FORBIDDEN.includes(skill));
  const candidates = [...new Set(state.court)].filter(canPerform);
  if (candidates.length === 0) return null;

  if (skill === 'S' && state.serving === 'us' && state.court[0] && canPerform(state.court[0])) return state.court[0];

  const matchCount = new Map<string, number>();
  for (const a of state.actions) {
    if (a.skill === skill) matchCount.set(a.playerId, (matchCount.get(a.playerId) ?? 0) + 1);
  }
  const avgPerMatch = (id: string) => {
    const h = usage.players[id];
    return h && h.matches > 0 ? (h.totals[skill] ?? 0) / h.matches : 0;
  };
  const avgSum = candidates.reduce((sum, id) => sum + avgPerMatch(id), 0);
  const score = (id: string) => (matchCount.get(id) ?? 0) + (avgSum > 0 ? (PRIOR_WEIGHT * avgPerMatch(id)) / avgSum : 0);

  const ranks = PREDICT_POSITION_RANK[skill];
  const positionRank = (id: string) => {
    const position = liberoIds.has(id) ? 'L' : (state.roles?.[id] ?? roster.get(id)!.positionCategory);
    const i = ranks.indexOf(position);
    return i >= 0 ? i : ranks.length;
  };

  const ranked = candidates
    .map((id) => ({ id, score: score(id), rank: positionRank(id), number: roster.get(id)!.number }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.number - b.number);
  return ranked[0].id;
}
