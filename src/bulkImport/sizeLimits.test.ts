import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { LIMITS } from '../types/limits';
import { parseJsonArray } from './parseJsonArray';
import { parseIssueText, sizeIssueText } from './importMessages';
import { validatePlayerRows } from '../players/playersImport';
import { playerImportIssueText } from '../players/playersImportMessages';
import { validateTeamRows } from '../teams/teamsImport';
import { teamImportIssueText } from '../teams/teamsImportMessages';
import { validateExerciseRows } from '../exercises/exercisesImport';
import { exerciseImportIssueText } from '../exercises/exercisesImportMessages';
import { validateTrainingRows } from '../trainings/trainingsImport';
import { trainingImportIssueText } from '../trainings/trainingsImportMessages';

// The bulk import enforces the same size caps as the forms and firestore.rules (src/types/limits.ts),
// so a row the rules would refuse is reported per row before anything is written.

const s = (n: number) => 'x'.repeat(n);
const SHORT = LIMITS.shortText;
const LONG = LIMITS.longText;

describe('parseJsonArray size cap', () => {
  it('refuses pasted text over LIMITS.importText before parsing it', () => {
    const text = `[${' '.repeat(LIMITS.importText)}]`;
    expect(parseJsonArray(text)).toEqual({ ok: false, error: { code: 'tooLarge', max: LIMITS.importText } });
  });

  it('parses text exactly at the cap', () => {
    const text = `[${' '.repeat(LIMITS.importText - 4)}{}]`.slice(0, LIMITS.importText);
    expect(text.length).toBe(LIMITS.importText);
    expect(parseJsonArray(text).ok).toBe(true);
  });

  it('explains the cap in English and Italian', () => {
    expect(parseIssueText({ code: 'tooLarge', max: LIMITS.importText }, en)).toBe(
      'the text is too long to import (more than 1,000,000 characters); split it into smaller batches',
    );
    expect(parseIssueText({ code: 'tooLarge', max: LIMITS.importText }, itCatalog)).toBe(
      'il testo è troppo lungo da importare (più di 1.000.000 caratteri); dividilo in gruppi più piccoli',
    );
  });
});

describe('size issue text', () => {
  it('names the row, the field and the cap', () => {
    expect(sizeIssueText({ code: 'tooLong', row: 2, field: 'name', max: 200 }, en)).toBe('row 2: "name" is longer than 200 characters');
    expect(sizeIssueText({ code: 'tooLong', row: 2, field: 'name', max: 10000 }, itCatalog)).toBe('riga 2: "name" supera i 10.000 caratteri');
    expect(sizeIssueText({ code: 'listTooLong', row: 3, field: 'guardians', max: 10 }, en)).toBe('row 3: "guardians" has more than 10 entries');
    expect(sizeIssueText({ code: 'listTooLong', row: 3, field: 'guardians', max: 10 }, itCatalog)).toBe('riga 3: "guardians" ha più di 10 voci');
  });

  it('is what every import maps a size issue to', () => {
    const issue = { code: 'tooLong', row: 1, field: 'description', max: LONG } as const;
    const expected = sizeIssueText(issue, en);
    expect(playerImportIssueText(issue, en)).toBe(expected);
    expect(teamImportIssueText(issue, en)).toBe(expected);
    expect(exerciseImportIssueText(issue, en)).toBe(expected);
    expect(trainingImportIssueText(issue, en)).toBe(expected);
  });
});

describe('player import size caps', () => {
  const guardian = { relation: 'mother', name: s(SHORT), phone: s(SHORT), email: s(LIMITS.email) };
  const atCap = {
    number: 4,
    fullName: s(SHORT),
    nationality: s(SHORT),
    licenseNumber: s(SHORT),
    playerPhone: s(SHORT),
    guardians: Array.from({ length: LIMITS.guardians }, () => guardian),
  };

  it('accepts every text field and the guardian list at its cap', () => {
    const result = validatePlayerRows([atCap]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toHaveLength(1);
  });

  it('reports each text field over its cap, and refuses the row', () => {
    const result = validatePlayerRows([
      atCap,
      { ...atCap, fullName: s(SHORT + 1), playerPhone: s(SHORT + 1), guardians: [{ ...guardian, email: s(LIMITS.email + 1) }] },
    ]);
    expect(result.inputs).toEqual([]);
    expect(result.errors).toEqual([
      { code: 'tooLong', row: 2, field: 'fullName', max: SHORT },
      { code: 'tooLong', row: 2, field: 'playerPhone', max: SHORT },
      { code: 'tooLong', row: 2, field: 'guardians[1].email', max: LIMITS.email },
    ]);
  });

  it('reports more guardians than the cap', () => {
    const result = validatePlayerRows([{ ...atCap, guardians: Array.from({ length: LIMITS.guardians + 1 }, () => guardian) }]);
    expect(result.errors).toEqual([{ code: 'listTooLong', row: 1, field: 'guardians', max: LIMITS.guardians }]);
  });
});

describe('team import size caps', () => {
  const atCap = { name: s(SHORT), ageGroup: s(SHORT), season: s(SHORT), description: s(LONG), gender: 'women' };

  it('accepts every text field at its cap', () => {
    expect(validateTeamRows([atCap]).errors).toEqual([]);
  });

  it('reports each text field over its cap, and refuses the row', () => {
    const result = validateTeamRows([atCap, { ...atCap, name: s(SHORT + 1), season: s(SHORT + 1), description: s(LONG + 1) }]);
    expect(result.inputs).toEqual([]);
    expect(result.errors).toEqual([
      { code: 'tooLong', row: 2, field: 'name', max: SHORT },
      { code: 'tooLong', row: 2, field: 'season', max: SHORT },
      { code: 'tooLong', row: 2, field: 'description', max: LONG },
    ]);
  });
});

describe('exercise import size caps', () => {
  const atCap = { name: s(SHORT), description: s(LONG), category: 'warmup' };

  it('accepts name and description at their caps', () => {
    expect(validateExerciseRows([atCap]).errors).toEqual([]);
  });

  it('reports them over their caps, and refuses the row', () => {
    const result = validateExerciseRows([{ ...atCap, name: s(SHORT + 1), description: s(LONG + 1) }]);
    expect(result.inputs).toEqual([]);
    expect(result.errors).toEqual([
      { code: 'tooLong', row: 1, field: 'name', max: SHORT },
      { code: 'tooLong', row: 1, field: 'description', max: LONG },
    ]);
  });
});

describe('training import size caps', () => {
  const atCap = { name: s(SHORT), description: s(LONG), ageGroupTarget: s(SHORT) };

  it('accepts name, description and age group at their caps', () => {
    expect(validateTrainingRows([atCap], new Map()).errors).toEqual([]);
  });

  it('reports them over their caps, and refuses the row', () => {
    const result = validateTrainingRows([{ name: s(SHORT + 1), description: s(LONG + 1), ageGroupTarget: s(SHORT + 1) }], new Map());
    expect(result.inputs).toEqual([]);
    expect(result.errors).toEqual([
      { code: 'tooLong', row: 1, field: 'name', max: SHORT },
      { code: 'tooLong', row: 1, field: 'description', max: LONG },
      { code: 'tooLong', row: 1, field: 'ageGroupTarget', max: SHORT },
    ]);
  });
});
