import { isPlainObject, textTooLong } from '../bulkImport/parseJsonArray';
import type { SizeIssue, ValidationResult } from '../bulkImport/types';
import { LIMITS } from '../types/limits';
import {
  POSITION_CATEGORIES,
  SHIRT_SIZES,
  SKILL_KEYS,
  type Guardian,
  type PositionCategory,
  type ShirtSize,
  type SkillKey,
} from '../types/player';

export interface PlayerImportInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  positionCategory: PositionCategory;
  shirtSize: ShirtSize | '';
  playerPhone: string;
  guardians: Guardian[];
  skills: Record<SkillKey, number | null>;
}

/** What is wrong with a row; `playerImportIssueText` turns it into text. */
export type PlayerImportIssue =
  | { code: 'notObject'; row: number }
  | { code: 'numberRequired'; row: number }
  | { code: 'fullNameRequired'; row: number }
  | { code: 'dobFormat'; row: number }
  | { code: 'mustBeText'; row: number; field: string }
  | { code: 'positionInvalid'; row: number; allowed: readonly string[] }
  | { code: 'shirtSizeInvalid'; row: number; allowed: readonly string[] }
  | { code: 'guardiansNotArray'; row: number }
  | { code: 'guardianNotObject'; row: number; guardian: number }
  | { code: 'guardianRelation'; row: number; guardian: number }
  | { code: 'guardianNameRequired'; row: number; guardian: number }
  | { code: 'skillsNotObject'; row: number }
  | { code: 'skillsUnknownKey'; row: number; key: string }
  | { code: 'skillRange'; row: number; key: string }
  | SizeIssue;

const RELATIONS: Guardian['relation'][] = ['mother', 'father', 'other'];
const POSITION_CATEGORY_VALUES = POSITION_CATEGORIES.map((c) => c.value);
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONAL_TEXT_FIELDS = ['nationality', 'licenseNumber', 'playerPhone'] as const;

export const PLAYER_IMPORT_EXAMPLE = `[
  {
    "number": 7,
    "fullName": "Jane Doe",
    "dob": "2010-04-12",
    "nationality": "LU",
    "licenseNumber": "12345",
    "positionCategory": "OH",
    "shirtSize": "M",
    "playerPhone": "",
    "guardians": [
      { "relation": "mother", "name": "Mary Doe", "phone": "+352 000 000", "email": "mary@example.com" }
    ],
    "skills": { "serve": 5, "attack": 6, "set": null, "defence": 4, "reception": 7, "jump": 5, "speed": 6, "iq": 5 }
  }
]`;

function nullSkills(): Record<SkillKey, number | null> {
  return SKILL_KEYS.reduce(
    (acc, key) => {
      acc[key] = null;
      return acc;
    },
    {} as Record<SkillKey, number | null>
  );
}

export function validatePlayerRows(rows: unknown[]): ValidationResult<PlayerImportInput, PlayerImportIssue> {
  const inputs: PlayerImportInput[] = [];
  const errors: PlayerImportIssue[] = [];

  rows.forEach((row, index) => {
    const n = index + 1;
    if (!isPlainObject(row)) {
      errors.push({ code: 'notObject', row: n });
      return;
    }
    let rowOk = true;
    const fail = (issue: PlayerImportIssue) => {
      errors.push(issue);
      rowOk = false;
    };

    if (!(typeof row.number === 'number' && Number.isFinite(row.number))) {
      fail({ code: 'numberRequired', row: n });
    }

    const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
    if (fullName === '') fail({ code: 'fullNameRequired', row: n });
    const long = (field: string, value: unknown, max: number) => {
      const issue = textTooLong(n, field, value, max);
      if (issue) fail(issue);
    };
    long('fullName', fullName, LIMITS.shortText);

    let dob = '';
    if (row.dob !== undefined) {
      if (typeof row.dob === 'string' && DOB_RE.test(row.dob)) dob = row.dob;
      else fail({ code: 'dobFormat', row: n });
    }

    const text: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) text[field] = '';
      else if (typeof row[field] === 'string') text[field] = row[field] as string;
      else fail({ code: 'mustBeText', row: n, field });
      long(field, row[field], LIMITS.shortText);
    }

    let positionCategory: PositionCategory = 'TBD';
    if (row.positionCategory !== undefined) {
      if (POSITION_CATEGORY_VALUES.includes(row.positionCategory as PositionCategory)) {
        positionCategory = row.positionCategory as PositionCategory;
      } else {
        fail({ code: 'positionInvalid', row: n, allowed: POSITION_CATEGORY_VALUES });
      }
    }

    let shirtSize: ShirtSize | '' = '';
    if (row.shirtSize !== undefined && row.shirtSize !== '') {
      if (SHIRT_SIZES.includes(row.shirtSize as ShirtSize)) {
        shirtSize = row.shirtSize as ShirtSize;
      } else {
        fail({ code: 'shirtSizeInvalid', row: n, allowed: SHIRT_SIZES });
      }
    }

    const guardians: Guardian[] = [];
    if (row.guardians !== undefined) {
      if (!Array.isArray(row.guardians)) {
        fail({ code: 'guardiansNotArray', row: n });
      } else if (row.guardians.length > LIMITS.guardians) {
        fail({ code: 'listTooLong', row: n, field: 'guardians', max: LIMITS.guardians });
      } else {
        row.guardians.forEach((g, j) => {
          const gn = j + 1;
          if (!isPlainObject(g)) {
            fail({ code: 'guardianNotObject', row: n, guardian: gn });
            return;
          }
          if (!(typeof g.relation === 'string' && RELATIONS.includes(g.relation as Guardian['relation']))) {
            fail({ code: 'guardianRelation', row: n, guardian: gn });
          }
          const gName = typeof g.name === 'string' ? g.name.trim() : '';
          if (gName === '') fail({ code: 'guardianNameRequired', row: n, guardian: gn });
          const gPhone = typeof g.phone === 'string' ? g.phone : '';
          const gEmail = typeof g.email === 'string' ? g.email : '';
          long(`guardians[${gn}].name`, gName, LIMITS.shortText);
          long(`guardians[${gn}].phone`, gPhone, LIMITS.shortText);
          long(`guardians[${gn}].email`, gEmail, LIMITS.email);
          if (rowOk) {
            guardians.push({ relation: g.relation as Guardian['relation'], name: gName, phone: gPhone, email: gEmail });
          }
        });
      }
    }

    const skills = nullSkills();
    if (row.skills !== undefined) {
      if (!isPlainObject(row.skills)) {
        fail({ code: 'skillsNotObject', row: n });
      } else {
        for (const [key, value] of Object.entries(row.skills)) {
          if (!(SKILL_KEYS as readonly string[]).includes(key)) {
            fail({ code: 'skillsUnknownKey', row: n, key });
            continue;
          }
          if (value === null) {
            skills[key as SkillKey] = null;
          } else if (typeof value === 'number' && value >= 1 && value <= 10) {
            skills[key as SkillKey] = value;
          } else {
            fail({ code: 'skillRange', row: n, key });
          }
        }
      }
    }

    if (rowOk) {
      inputs.push({
        number: row.number as number,
        fullName,
        dob,
        nationality: text.nationality,
        licenseNumber: text.licenseNumber,
        positionCategory,
        shirtSize,
        playerPhone: text.playerPhone,
        guardians,
        skills,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
