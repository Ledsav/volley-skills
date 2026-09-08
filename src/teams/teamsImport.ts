import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import type { NewTeamInput } from './teamsApi';

export const TEAM_IMPORT_EXAMPLE = `[
  {
    "name": "VCB U15 Girls",
    "club": "Volley Club Belair",
    "ageGroup": "U15",
    "season": "2026-27",
    "description": ""
  }
]`;

const OPTIONAL_TEXT_FIELDS = ['club', 'ageGroup', 'season', 'description'] as const;

export function validateTeamRows(rows: unknown[]): ValidationResult<NewTeamInput> {
  const inputs: NewTeamInput[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push(`row ${n}: each entry must be a JSON object`);
      return;
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push(`row ${n}: "name" is required`);

    const optionals: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) {
        optionals[field] = '';
      } else if (typeof row[field] === 'string') {
        optionals[field] = row[field] as string;
      } else {
        errors.push(`row ${n}: "${field}" must be text`);
      }
    }

    if (name !== '' && Object.keys(optionals).length === OPTIONAL_TEXT_FIELDS.length) {
      inputs.push({
        name,
        club: optionals.club,
        ageGroup: optionals.ageGroup,
        season: optionals.season,
        description: optionals.description,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
