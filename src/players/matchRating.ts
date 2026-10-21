import { attackEff, mergeLines, ratio, serveEff } from '../matches/scoutStats';
import { GRADES, SKILLS, type Grade, type Match, type PlayerStats, type Skill, type SkillLine } from '../types/match';
import type { SkillKey } from '../types/player';

/** How much each grade is worth when turning a skill's grades into a 0..1 quality. */
export const GRADE_WEIGHTS: Record<Grade, number> = { '#': 1, '+': 0.75, '!': 0.5, '-': 0.25, '/': 0, '=': 0 };

/** Below this many season attempts a skill gets no rating ("not enough data"). */
const MIN_ATTEMPTS = 15;

/** Scouted fundamentals behind each profile skill. jump, speed and iq have none. */
const SKILL_SOURCES: Partial<Record<SkillKey, Skill[]>> = {
  serve: ['S'],
  reception: ['R'],
  attack: ['A'],
  block: ['B'],
  set: ['E'],
  defence: ['D', 'F'],
};

export interface SeasonMatchRow {
  matchId: string;
  date: string;
  opponent: string;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  points: number;
  errors: number;
}

export interface SeasonStats {
  /** Matches where the player has at least one action. */
  matchesPlayed: number;
  /** Grade counts summed across matches. */
  skills: Partial<Record<Skill, SkillLine>>;
  attackEff: number | null;
  serveEff: number | null;
  receptionPos: number | null;
  receptionPerfect: number | null;
  points: number;
  errors: number;
  /** Newest first, matches played only. */
  rows: SeasonMatchRow[];
}

export interface MatchRating {
  /** 1–10, or null when attempts < MIN_ATTEMPTS. */
  rating: number | null;
  attempts: number;
}

export type MatchRatings = Partial<Record<SkillKey, MatchRating>>;

function hasActions(stats: PlayerStats): boolean {
  return Object.values(stats.skills).some((l) => !!l && l.attempts > 0);
}

/** Aggregates a player's scouted season from finished matches' saved summaries; never reads events. */
export function seasonStats(matches: Match[], playerId: string): SeasonStats {
  const played: { match: Match; stats: PlayerStats }[] = [];
  for (const match of matches) {
    const stats = match.summary?.players[playerId];
    if (stats && hasActions(stats)) played.push({ match, stats });
  }

  const skills: Partial<Record<Skill, SkillLine>> = {};
  for (const s of SKILLS) {
    const merged = mergeLines(played.map((p) => p.stats.skills[s]));
    if (merged) skills[s] = merged;
  }
  const r = skills.R;

  return {
    matchesPlayed: played.length,
    skills,
    attackEff: attackEff(skills.A),
    serveEff: serveEff(skills.S),
    receptionPos: r ? ratio(r.grades['#'] + r.grades['+'], r.attempts) : null,
    receptionPerfect: r ? ratio(r.grades['#'], r.attempts) : null,
    points: played.reduce((sum, p) => sum + p.stats.points, 0),
    errors: played.reduce((sum, p) => sum + p.stats.errors, 0),
    rows: played
      .map(({ match, stats }) => ({
        matchId: match.id,
        date: match.date,
        opponent: match.opponent,
        attackEff: stats.attackEff,
        serveEff: stats.serveEff,
        receptionPos: stats.receptionPos,
        points: stats.points,
        errors: stats.errors,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** A 1–10 match rating per profile skill that has scouted data. */
export function matchRatings(season: SeasonStats): MatchRatings {
  const out: MatchRatings = {};
  for (const [key, sources] of Object.entries(SKILL_SOURCES) as [SkillKey, Skill[]][]) {
    const merged = mergeLines(sources.map((s) => season.skills[s]));
    if (!merged || merged.attempts === 0) continue;
    if (merged.attempts < MIN_ATTEMPTS) {
      out[key] = { rating: null, attempts: merged.attempts };
      continue;
    }
    const quality = GRADES.reduce((sum, g) => sum + merged.grades[g] * GRADE_WEIGHTS[g], 0) / merged.attempts;
    out[key] = { rating: 1 + 9 * quality, attempts: merged.attempts };
  }
  return out;
}

/** The whole-number score the edit form offers for a rating. */
export function suggestedScore(rating: number): number {
  return Math.min(10, Math.max(1, Math.round(rating)));
}
