import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type ExerciseCategory } from '../types/exercise';
import type { NewTrainingInput, TrainingExercise } from '../types/training';

const CATEGORY_KEYS = EXERCISE_CATEGORIES.map((c) => c.key);

/** What is wrong with a row; `trainingImportIssueText` turns it into text. */
export type TrainingImportIssue =
  | { code: 'notObject'; row: number }
  | { code: 'nameRequired'; row: number }
  | { code: 'descriptionText'; row: number }
  | { code: 'ageGroupText'; row: number }
  | { code: 'suggestedPlayersRange'; row: number; min: number; max: number }
  | { code: 'targetsInvalid'; row: number; options: string[] }
  | { code: 'exercisesNotArray'; row: number }
  | { code: 'tooManyExercises'; row: number; max: number }
  | { code: 'exerciseNotObject'; row: number; exercise: number }
  | { code: 'exerciseNameRequired'; row: number; exercise: number }
  | { code: 'exerciseDuration'; row: number; exercise: number }
  | { code: 'exerciseNotFound'; row: number; name: string }
  | { code: 'exerciseAmbiguous'; row: number; name: string; count: number }
  | { code: 'tooManyNames'; max: number };

export const MAX_EXERCISES_PER_TRAINING = 50;
export const MAX_IMPORT_EXERCISE_NAMES = 500;

export const TRAINING_IMPORT_EXAMPLE = `[
  {
    "name": "Defense + reception: block and dig transition",
    "description": "Rotational blocking + dig transition",
    "ageGroupTarget": "U17",
    "suggestedPlayers": 12,
    "targets": ["defense", "reception"],
    "exercises": [
      { "name": "Reception: butterfly passing", "durationMinutes": 15 },
      { "name": "Defense: block footwork ladder", "durationMinutes": 10 }
    ]
  }
]`;

export function collectExerciseNames(rows: unknown[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    if (!isPlainObject(row) || !Array.isArray(row.exercises)) continue;
    for (const entry of row.exercises) {
      if (isPlainObject(entry) && typeof entry.name === 'string' && entry.name.trim() !== '') {
        seen.add(entry.name.trim());
      }
    }
  }
  return [...seen];
}

export function validateTrainingRows(
  rows: unknown[],
  nameToIds: Map<string, string[]>
): ValidationResult<NewTrainingInput, TrainingImportIssue> {
  const inputs: NewTrainingInput[] = [];
  const errors: TrainingImportIssue[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push({ code: 'notObject', row: n });
      return;
    }
    let rowOk = true;
    const fail = (issue: TrainingImportIssue) => {
      errors.push(issue);
      rowOk = false;
    };

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') fail({ code: 'nameRequired', row: n });

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else fail({ code: 'descriptionText', row: n });
    }
    let ageGroupTarget = '';
    if (row.ageGroupTarget !== undefined) {
      if (typeof row.ageGroupTarget === 'string') ageGroupTarget = row.ageGroupTarget;
      else fail({ code: 'ageGroupText', row: n });
    }

    const { min, max } = PLAYER_LIMITS.suggestedPlayers;
    const suggestedPlayers = row.suggestedPlayers;
    if (
      suggestedPlayers !== undefined &&
      !(Number.isInteger(suggestedPlayers) && (suggestedPlayers as number) >= min && (suggestedPlayers as number) <= max)
    ) {
      fail({ code: 'suggestedPlayersRange', row: n, min, max });
    }
    let targets: ExerciseCategory[] = [];
    if (row.targets !== undefined) {
      const valid =
        Array.isArray(row.targets) &&
        row.targets.every((t) => typeof t === 'string' && (CATEGORY_KEYS as string[]).includes(t));
      if (valid) targets = [...new Set(row.targets as ExerciseCategory[])];
      else fail({ code: 'targetsInvalid', row: n, options: CATEGORY_KEYS });
    }

    const exercises: TrainingExercise[] = [];
    if (row.exercises !== undefined) {
      if (!Array.isArray(row.exercises)) {
        fail({ code: 'exercisesNotArray', row: n });
      } else if (row.exercises.length > MAX_EXERCISES_PER_TRAINING) {
        fail({ code: 'tooManyExercises', row: n, max: MAX_EXERCISES_PER_TRAINING });
      } else {
        row.exercises.forEach((entry, k) => {
          const m = k + 1;
          if (!isPlainObject(entry)) {
            fail({ code: 'exerciseNotObject', row: n, exercise: m });
            return;
          }
          const exName = typeof entry.name === 'string' ? entry.name.trim() : '';
          if (exName === '') fail({ code: 'exerciseNameRequired', row: n, exercise: m });
          const duration = entry.durationMinutes;
          if (!(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) {
            fail({ code: 'exerciseDuration', row: n, exercise: m });
          }
          if (exName !== '') {
            const ids = nameToIds.get(exName);
            if (!ids || ids.length === 0) {
              fail({ code: 'exerciseNotFound', row: n, name: exName });
            } else if (ids.length > 1) {
              fail({ code: 'exerciseAmbiguous', row: n, name: exName, count: ids.length });
            } else if (typeof duration === 'number' && duration > 0) {
              exercises.push({ exerciseId: ids[0], order: m, durationMinutes: duration });
            }
          }
        });
      }
    }

    if (rowOk) {
      inputs.push({
        name,
        description,
        ageGroupTarget,
        exercises,
        ...(suggestedPlayers !== undefined ? { suggestedPlayers: suggestedPlayers as number } : {}),
        ...(targets.length > 0 ? { targets } : {}),
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
