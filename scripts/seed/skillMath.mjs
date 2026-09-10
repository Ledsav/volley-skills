// Mirror of src/players/skillMath.ts for the seed/backfill scripts (which can't
// import from src/). Keep the band thresholds in sync with the app.
import { SKILL_KEYS } from './parseWorkbook.mjs';

export function computeAvgScore(skills) {
  const scores = SKILL_KEYS.map((k) => skills[k]?.score).filter((s) => s !== null && s !== undefined);
  if (scores.length === 0) return null;
  return scores.reduce((t, s) => t + s, 0) / scores.length;
}

export function computeLevel(avg) {
  if (avg === null) return null;
  if (avg < 4) return 'Beginner';
  if (avg < 6) return 'Developing';
  if (avg < 8) return 'Advanced';
  return 'Elite';
}
