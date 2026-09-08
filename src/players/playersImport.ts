import { isPlainObject } from '../bulkImport/parseJsonArray';
import type { ValidationResult } from '../bulkImport/types';
import { SKILL_KEYS, type Guardian, type SkillKey } from '../types/player';

export interface PlayerImportInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  position: string;
  playerPhone: string;
  guardians: Guardian[];
  skills: Record<SkillKey, number | null>;
}

const RELATIONS: Guardian['relation'][] = ['mother', 'father', 'other'];
const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPTIONAL_TEXT_FIELDS = ['nationality', 'licenseNumber', 'position', 'playerPhone'] as const;

export const PLAYER_IMPORT_EXAMPLE = `[
  {
    "number": 7,
    "fullName": "Jane Doe",
    "dob": "2010-04-12",
    "nationality": "LU",
    "licenseNumber": "12345",
    "position": "Outside hitter",
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

export function validatePlayerRows(rows: unknown[]): ValidationResult<PlayerImportInput> {
  const inputs: PlayerImportInput[] = [];
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

    if (!(typeof row.number === 'number' && Number.isFinite(row.number))) {
      fail(`row ${n}: "number" is required and must be a number`);
    }

    const fullName = typeof row.fullName === 'string' ? row.fullName.trim() : '';
    if (fullName === '') fail(`row ${n}: "fullName" is required`);

    let dob = '';
    if (row.dob !== undefined) {
      if (typeof row.dob === 'string' && DOB_RE.test(row.dob)) dob = row.dob;
      else fail(`row ${n}: "dob" must be YYYY-MM-DD`);
    }

    const text: Record<string, string> = {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      if (row[field] === undefined) text[field] = '';
      else if (typeof row[field] === 'string') text[field] = row[field] as string;
      else fail(`row ${n}: "${field}" must be text`);
    }

    const guardians: Guardian[] = [];
    if (row.guardians !== undefined) {
      if (!Array.isArray(row.guardians)) {
        fail(`row ${n}: "guardians" must be an array`);
      } else {
        row.guardians.forEach((g, j) => {
          const gn = j + 1;
          if (!isPlainObject(g)) {
            fail(`row ${n}: guardian ${gn} must be an object`);
            return;
          }
          if (!(typeof g.relation === 'string' && RELATIONS.includes(g.relation as Guardian['relation']))) {
            fail(`row ${n}: guardian ${gn} "relation" must be mother, father, or other`);
          }
          const gName = typeof g.name === 'string' ? g.name.trim() : '';
          if (gName === '') fail(`row ${n}: guardian ${gn} "name" is required`);
          const gPhone = typeof g.phone === 'string' ? g.phone : '';
          const gEmail = typeof g.email === 'string' ? g.email : '';
          if (rowOk) {
            guardians.push({ relation: g.relation as Guardian['relation'], name: gName, phone: gPhone, email: gEmail });
          }
        });
      }
    }

    const skills = nullSkills();
    if (row.skills !== undefined) {
      if (!isPlainObject(row.skills)) {
        fail(`row ${n}: "skills" must be an object`);
      } else {
        for (const [key, value] of Object.entries(row.skills)) {
          if (!(SKILL_KEYS as string[]).includes(key)) {
            fail(`row ${n}: "skills" has an unknown key "${key}"`);
            continue;
          }
          if (value === null) {
            skills[key as SkillKey] = null;
          } else if (typeof value === 'number' && value >= 1 && value <= 10) {
            skills[key as SkillKey] = value;
          } else {
            fail(`row ${n}: "skills.${key}" must be a number from 1 to 10, or null`);
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
        position: text.position,
        playerPhone: text.playerPhone,
        guardians,
        skills,
      });
    }
  });

  return errors.length > 0 ? { inputs: [], errors } : { inputs, errors: [] };
}
