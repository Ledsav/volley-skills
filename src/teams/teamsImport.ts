import { isGender } from './teamGender';
import { isPlainObject, textTooLong } from '../bulkImport/parseJsonArray';
import type { SizeIssue, ValidationResult } from '../bulkImport/types';
import { LIMITS } from '../types/limits';
import type { NewTeamInput } from './teamsApi';

export const TEAM_IMPORT_EXAMPLE = `[
  {
    "name": "U15 Girls",
    "ageGroup": "U15",
    "season": "2026-27",
    "description": "",
    "gender": "women"
  }
]`;

/** What is wrong with a row; `teamImportIssueText` turns it into text. */
export type TeamImportIssue =
  | { code: 'notObject'; row: number }
  | { code: 'nameRequired'; row: number }
  | { code: 'genderRequired'; row: number }
  | { code: 'genderInvalid'; row: number }
  | { code: 'mustBeText'; row: number; field: string }
  | SizeIssue;

const OPTIONAL_TEXT_FIELDS = ['ageGroup', 'season', 'description'] as const;
const MAX_LENGTH: Record<'name' | (typeof OPTIONAL_TEXT_FIELDS)[number], number> = {
  name: LIMITS.shortText,
  ageGroup: LIMITS.shortText,
  season: LIMITS.shortText,
  description: LIMITS.longText,
};

export function validateTeamRows(rows: unknown[]): ValidationResult<NewTeamInput, TeamImportIssue> {
  const inputs: NewTeamInput[] = [];
  const errors: TeamImportIssue[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push({ code: 'notObject', row: n });
      return;
    }

    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (name === '') errors.push({ code: 'nameRequired', row: n });

    const errorsBefore = errors.length;
    for (const field of ['name', ...OPTIONAL_TEXT_FIELDS] as const) {
      const issue = textTooLong(n, field, field === 'name' ? name : row[field], MAX_LENGTH[field]);
      if (issue) errors.push(issue);
    }
    const sizeOk = errors.length === errorsBefore;

    const rawGender = typeof row.gender === 'string' ? row.gender.trim().toLowerCase() : row.gender;
    const gender = isGender(rawGender) ? rawGender : null;
    if (rawGender === undefined || rawGender === '') errors.push({ code: 'genderRequired', row: n });
    else if (gender === null) errors.push({ code: 'genderInvalid', row: n });

    const optionals: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) {
        optionals[field] = '';
      } else if (typeof row[field] === 'string') {
        optionals[field] = row[field] as string;
      } else {
        errors.push({ code: 'mustBeText', row: n, field });
      }
    }

    if (sizeOk && name !== '' && gender !== null && Object.keys(optionals).length === OPTIONAL_TEXT_FIELDS.length) {
      inputs.push({
        name,
        ageGroup: optionals.ageGroup,
        season: optionals.season,
        description: optionals.description,
        gender,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
