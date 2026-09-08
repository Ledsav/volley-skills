import type { Level, Player, Skills } from '../types/player';

export function computeAvgScore(skills: Skills): number | null {
  const scores = Object.values(skills)
    .map((entry) => entry.score)
    .filter((score): score is number => score !== null && score !== undefined);
  if (scores.length === 0) return null;
  const sum = scores.reduce((total, score) => total + score, 0);
  return sum / scores.length;
}

export function computeLevel(avgScore: number | null): Level | null {
  if (avgScore === null) return null;
  if (avgScore < 4) return 'Beginner';
  if (avgScore < 6) return 'Developing';
  if (avgScore < 8) return 'Advanced';
  return 'Elite';
}

export function computeTeamAvgScore(players: Player[]): number | null {
  const scores = players
    .map((player) => player.avgScore)
    .filter((score): score is number => score !== null && score !== undefined);
  if (scores.length === 0) return null;
  return scores.reduce((total, score) => total + score, 0) / scores.length;
}
