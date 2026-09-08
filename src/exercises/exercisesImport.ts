import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { EXERCISE_CATEGORIES, type NewExerciseInput } from '../types/exercise';

const CATEGORY_KEYS = EXERCISE_CATEGORIES.map((c) => c.key);

export const EXERCISE_IMPORT_EXAMPLE = `[
  {
    "name": "Butterfly passing",
    "description": "3-player weave, continuous",
    "category": "reception"
  },
  {
    "name": "Block footwork ladder",
    "category": "defense"
  }
]`;

export function validateExerciseRows(rows: unknown[]): ValidationResult<NewExerciseInput> {
  const inputs: NewExerciseInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push(`row ${n}: "name" is required`);

    if (!(typeof row.category === 'string' && (CATEGORY_KEYS as string[]).includes(row.category))) {
      errors.push(`row ${n}: "category" must be one of ${CATEGORY_KEYS.join(', ')}`);
    }

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else errors.push(`row ${n}: "description" must be text`);
    }

    if (name !== '' && typeof row.category === 'string' && (CATEGORY_KEYS as string[]).includes(row.category)) {
      inputs.push({ name, description, category: row.category as NewExerciseInput['category'] });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
