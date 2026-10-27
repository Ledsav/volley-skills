import { getT } from '../i18n/I18nProvider';

/**
 * The club's naming convention, shown in the create forms and given to the AI drafts.
 * Exercises: "Focus: what it trains / how it runs". Trainings: "Focus + focus: objective".
 * Levels, age groups and player counts live in their own fields, not in names.
 * The focus words below are the English codes; the active language's words (`t.labels.exerciseFocus`)
 * are accepted too, and the examples and hints come from the catalog.
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

export type ExerciseFocus = (typeof EXERCISE_FOCUSES)[number];

/** The focus words in the active language, in convention order. */
export function exerciseFocusLabels(): string[] {
  const labels = getT().labels.exerciseFocus;
  return EXERCISE_FOCUSES.map((f) => labels[f]);
}

export const exerciseNameExample = (): string => getT().aiDraft.naming.exerciseExample;
export const trainingNameExample = (): string => getT().aiDraft.naming.trainingExample;

export function exerciseNameHint(): string {
  return getT().exercises.form.nameHint(exerciseNameExample(), exerciseFocusLabels().join(', '));
}

export const trainingNameHint = (): string => getT().aiDraft.naming.trainingHint(trainingNameExample());

export function followsExerciseNaming(name: string): boolean {
  const m = /^([^:]+):\s*(\S.*)$/.exec(name.trim());
  if (m === null) return false;
  const focus = m[1].trim();
  return (EXERCISE_FOCUSES as readonly string[]).includes(focus) || exerciseFocusLabels().includes(focus);
}
