import { computeLevel } from '../../players/skillMath';
import type { MatchRatings } from '../../players/matchRating';
import type { AwardId } from '../../types/awards';
import type { Level } from '../../types/player';

/** The rated skill behind each stat award; awards without one (top scorer, MVP) have no band. */
export const AWARD_RATING_SKILL: Partial<Record<AwardId, 'serve' | 'reception' | 'attack' | 'block' | 'set' | 'defence'>> = {
  attacker: 'attack',
  server: 'serve',
  receiver: 'reception',
  blocker: 'block',
  defender: 'defence',
  setter: 'set',
};

/** Bar length against the card's leader; a leader at or below zero draws empty bars. */
export function barFraction(value: number, leader: number): number {
  if (!(leader > 0)) return 0;
  return Math.min(1, Math.max(0, value) / leader);
}

/** Level band of the player's season rating for the award's skill. */
export function leaderBand(id: AwardId, ratings: MatchRatings | undefined): Level | null {
  const skill = AWARD_RATING_SKILL[id];
  if (!skill) return null;
  return computeLevel(ratings?.[skill]?.rating ?? null);
}

export const BAND_BAR_CLASS: Record<Level, string> = {
  Beginner: 'bg-red',
  Developing: 'bg-orange',
  Advanced: 'bg-blue',
  Elite: 'bg-green',
};
