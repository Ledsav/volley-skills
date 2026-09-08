import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import type { NewTrainingInput, TrainingExercise } from '../types/training';

export const TRAINING_IMPORT_EXAMPLE = `[
  {
    "name": "U17 defense circuit",
    "description": "Rotational blocking + dig transition",
    "ageGroupTarget": "U17",
    "exercises": [
      { "name": "Butterfly passing", "durationMinutes": 15 },
      { "name": "Block footwork ladder", "durationMinutes": 10 }
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
): ValidationResult<NewTrainingInput> {
  const inputs: NewTrainingInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }
    let rowOk = true;
    const fail = (msg: string) => {
      errors.push(msg);
      rowOk = false;
    };

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') fail(`row ${n}: "name" is required`);

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else fail(`row ${n}: "description" must be text`);
    }
    let ageGroupTarget = '';
    if (row.ageGroupTarget !== undefined) {
      if (typeof row.ageGroupTarget === 'string') ageGroupTarget = row.ageGroupTarget;
      else fail(`row ${n}: "ageGroupTarget" must be text`);
    }

    const exercises: TrainingExercise[] = [];
    if (row.exercises !== undefined) {
      if (!Array.isArray(row.exercises)) {
        fail(`row ${n}: "exercises" must be an array`);
      } else {
        row.exercises.forEach((entry, k) => {
          const m = k + 1;
          if (!isPlainObject(entry)) {
            fail(`row ${n}: exercise ${m} must be an object`);
            return;
          }
          const exName = typeof entry.name === 'string' ? entry.name.trim() : '';
          if (exName === '') fail(`row ${n}: exercise ${m} "name" is required`);
          const duration = entry.durationMinutes;
          if (!(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) {
            fail(`row ${n}: exercise ${m} "durationMinutes" must be a number greater than 0`);
          }
          if (exName !== '') {
            const ids = nameToIds.get(exName);
            if (!ids || ids.length === 0) {
              fail(`row ${n}: exercise "${exName}" was not found in the library`);
            } else if (ids.length > 1) {
              fail(
                `row ${n}: exercise "${exName}" is ambiguous — ${ids.length} exercises share that name; rename or remove duplicates`
              );
            } else if (typeof duration === 'number' && duration > 0) {
              exercises.push({ exerciseId: ids[0], order: m, durationMinutes: duration });
            }
          }
        });
      }
    }

    if (rowOk) {
      inputs.push({ name, description, ageGroupTarget, exercises });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
