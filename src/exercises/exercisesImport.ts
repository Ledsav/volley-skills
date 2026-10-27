import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { parseScene, type SceneIssue } from '../diagrams/parseScene';
import { SCENE_LIMITS, type Scene } from '../types/diagram';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type NewExerciseInput } from '../types/exercise';

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

/** What is wrong with a row; `exerciseImportIssueText` turns it into text. */
export type ExerciseImportIssue =
  | { code: 'notObject'; row: number }
  | { code: 'nameRequired'; row: number }
  | { code: 'categoryInvalid'; row: number; options: string[] }
  | { code: 'descriptionText'; row: number }
  | { code: 'minPlayersRange'; row: number; min: number; max: number }
  | { code: 'diagramsNotArray'; row: number }
  | { code: 'tooManyDiagrams'; row: number; max: number }
  | { code: 'diagramNotObject'; row: number; diagram: number }
  | { code: 'diagramTitle'; row: number; diagram: number; max: number }
  | { code: 'diagramScene'; row: number; diagram: number; scene: SceneIssue };

export const EXERCISE_IMPORT_EXAMPLE = `[
  {
    "name": "Reception: butterfly passing",
    "description": "3-player weave, continuous",
    "category": "reception",
    "minPlayers": 3,
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
    "name": "Defense: block footwork ladder",
    "category": "defense"
  }
]`;

export function validateExerciseRows(rows: unknown[]): ValidationResult<ExerciseImportInput, ExerciseImportIssue> {
  const inputs: ExerciseImportInput[] = [];
  const errors: ExerciseImportIssue[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push({ code: 'notObject', row: n });
      return;
    }

    const errorsBefore = errors.length;

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push({ code: 'nameRequired', row: n });

    if (!(typeof row.category === 'string' && (CATEGORY_KEYS as string[]).includes(row.category))) {
      errors.push({ code: 'categoryInvalid', row: n, options: CATEGORY_KEYS });
    }

    let description = '';
    if (row.description !== undefined) {
      if (typeof row.description === 'string') description = row.description;
      else errors.push({ code: 'descriptionText', row: n });
    }

    const { min, max } = PLAYER_LIMITS.minPlayers;
    const minPlayers = row.minPlayers;
    if (minPlayers !== undefined && !(Number.isInteger(minPlayers) && (minPlayers as number) >= min && (minPlayers as number) <= max)) {
      errors.push({ code: 'minPlayersRange', row: n, min, max });
    }

    const diagrams: ImportedDiagram[] = [];
    if (row.diagrams !== undefined) {
      if (!Array.isArray(row.diagrams)) {
        errors.push({ code: 'diagramsNotArray', row: n });
      } else if (row.diagrams.length > SCENE_LIMITS.diagramsPerExercise) {
        errors.push({ code: 'tooManyDiagrams', row: n, max: SCENE_LIMITS.diagramsPerExercise });
      } else {
        row.diagrams.forEach((d, di) => {
          const m = di + 1;
          if (!isPlainObject(d)) {
            errors.push({ code: 'diagramNotObject', row: n, diagram: m });
            return;
          }

          const title = typeof d.title === 'string' ? d.title.trim() : '';
          const titleOk = title.length >= 1 && title.length <= SCENE_LIMITS.titleLength;
          if (!titleOk) {
            errors.push({ code: 'diagramTitle', row: n, diagram: m, max: SCENE_LIMITS.titleLength });
          }

          const parsed = parseScene(d.scene);
          if (!parsed.ok) {
            errors.push({ code: 'diagramScene', row: n, diagram: m, scene: parsed.error });
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
        ...(minPlayers !== undefined ? { minPlayers: minPlayers as number } : {}),
        diagrams,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
