/**
 * The club's naming convention, shown in the create forms and given to the AI drafts.
 * Exercises: "Focus: what it trains / how it runs". Trainings: "Focus + focus: objective".
 * Levels, age groups and player counts live in their own fields, not in names.
 */
export const EXERCISE_FOCUSES = [
  'Warm-up',
  'Physical',
  'Test',
  'Serve',
  'Reception',
  'Free ball',
  'Setting',
  'Attack',
  'Defense',
  'Transition',
  'Combination',
  'Game',
] as const;

export const EXERCISE_NAME_EXAMPLE = 'Reception: mixed serves to target';
export const TRAINING_NAME_EXAMPLE = 'Reception + free ball: control and convert';

export const EXERCISE_NAME_HINT = `Name it "Focus: what it trains", e.g. "${EXERCISE_NAME_EXAMPLE}". Focus is one of: ${EXERCISE_FOCUSES.join(', ')}.`;
export const TRAINING_NAME_HINT = `Name it "Focus + focus: objective", e.g. "${TRAINING_NAME_EXAMPLE}". Age group and players have their own fields.`;

export function followsExerciseNaming(name: string): boolean {
  const m = /^([^:]+):\s*(\S.*)$/.exec(name.trim());
  return m !== null && (EXERCISE_FOCUSES as readonly string[]).includes(m[1].trim());
}
