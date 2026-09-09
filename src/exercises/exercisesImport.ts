import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { parseScene } from '../diagrams/parseScene';
import { SCENE_LIMITS, type Scene } from '../types/diagram';
import { EXERCISE_CATEGORIES, type NewExerciseInput } from '../types/exercise';

const CATEGORY_KEYS = EXERCISE_CATEGORIES.map((c) => c.key);

/** One court diagram carried inline by an import row, already parsed + repaired. */
export interface ImportedDiagram {
  title: string;
  order: number;
  scene: Scene;
}

/** An exercise import row plus its (possibly empty) validated diagrams. */
export interface ExerciseImportInput extends NewExerciseInput {
  diagrams: ImportedDiagram[];
}

export const EXERCISE_IMPORT_EXAMPLE = `[
  {
    "name": "Butterfly passing",
    "description": "3-player weave, continuous",
    "category": "reception",
    "diagrams": [
      {
        "title": "Setup",
        "scene": {
          "v": 1,
          "court": "full",
          "showZones": false,
          "items": [
            { "id": "p1", "type": "player", "x": 30, "y": 70, "rotation": 0, "size": 1, "color": "blue", "label": "1", "shape": "circle" },
            { "id": "b1", "type": "ball", "x": 50, "y": 50, "rotation": 0, "size": 1, "color": "orange" }
          ]
        }
      }
    ]
  },
  {
    "name": "Block footwork ladder",
    "category": "defense"
  }
]`;

export function validateExerciseRows(rows: unknown[]): ValidationResult<ExerciseImportInput> {
  const inputs: ExerciseImportInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }

    const errorsBefore = errors.length;

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

    const diagrams: ImportedDiagram[] = [];
    if (row.diagrams !== undefined) {
      if (!Array.isArray(row.diagrams)) {
        errors.push(`row ${n}: "diagrams" must be an array`);
      } else if (row.diagrams.length > SCENE_LIMITS.diagramsPerExercise) {
        errors.push(`row ${n}: at most ${SCENE_LIMITS.diagramsPerExercise} diagrams per exercise`);
      } else {
        row.diagrams.forEach((d, di) => {
          const m = di + 1;
          if (!isPlainObject(d)) {
            errors.push(`row ${n}: diagram ${m} must be an object`);
            return;
          }

          const title = typeof d.title === 'string' ? d.title.trim() : '';
          const titleOk = title.length >= 1 && title.length <= SCENE_LIMITS.titleLength;
          if (!titleOk) {
            errors.push(`row ${n}: diagram ${m}: "title" must be 1–${SCENE_LIMITS.titleLength} characters`);
          }

          const parsed = parseScene(d.scene);
          if (!parsed.ok) {
            errors.push(`row ${n}: diagram ${m}: scene is invalid (${parsed.error})`);
          }

          if (titleOk && parsed.ok) {
            diagrams.push({ title, order: m - 1, scene: parsed.scene });
          }
        });
      }
    }

    // A row contributes an input only when it is completely clean — the same
    // posture the name/category checks already enforce, extended to diagrams.
    if (errors.length === errorsBefore) {
      inputs.push({
        name,
        description,
        category: row.category as NewExerciseInput['category'],
        diagrams,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
