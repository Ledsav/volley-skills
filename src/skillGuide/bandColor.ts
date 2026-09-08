/**
 * Border-color class for a skill-guide score range, tied to the same
 * Beginner/Developing/Advanced/Elite bands used everywhere else (skillMath.ts,
 * the roster's level pill, the skill meter) — see design-system spec §2.4.
 */
export function bandBorderClass(min: number): string {
  if (min < 4) return 'border-red';
  if (min < 7) return 'border-orange';
  if (min < 9) return 'border-blue';
  return 'border-green';
}
