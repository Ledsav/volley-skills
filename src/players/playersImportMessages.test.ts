import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { playerImportIssueText } from './playersImportMessages';

describe('player import issue texts', () => {
  it('keeps the English wording of every player import issue', () => {
    expect(playerImportIssueText({ code: 'notObject', row: 1 }, en)).toBe('row 1: each entry must be a JSON object');
    expect(playerImportIssueText({ code: 'numberRequired', row: 2 }, en)).toBe('row 2: "number" is required and must be a number');
    expect(playerImportIssueText({ code: 'fullNameRequired', row: 3 }, en)).toBe('row 3: "fullName" is required');
    expect(playerImportIssueText({ code: 'dobFormat', row: 4 }, en)).toBe('row 4: "dob" must be YYYY-MM-DD');
    expect(playerImportIssueText({ code: 'mustBeText', row: 5, field: 'nationality' }, en)).toBe('row 5: "nationality" must be text');
    expect(playerImportIssueText({ code: 'positionInvalid', row: 6, allowed: ['S', 'OH'] }, en)).toBe(
      'row 6: "positionCategory" must be one of S, OH'
    );
    expect(playerImportIssueText({ code: 'shirtSizeInvalid', row: 7, allowed: ['S', 'M'] }, en)).toBe('row 7: "shirtSize" must be one of S, M');
    expect(playerImportIssueText({ code: 'guardiansNotArray', row: 8 }, en)).toBe('row 8: "guardians" must be an array');
    expect(playerImportIssueText({ code: 'guardianNotObject', row: 1, guardian: 2 }, en)).toBe('row 1: guardian 2 must be an object');
    expect(playerImportIssueText({ code: 'guardianRelation', row: 1, guardian: 1 }, en)).toBe(
      'row 1: guardian 1 "relation" must be mother, father, or other'
    );
    expect(playerImportIssueText({ code: 'guardianNameRequired', row: 1, guardian: 1 }, en)).toBe('row 1: guardian 1 "name" is required');
    expect(playerImportIssueText({ code: 'skillsNotObject', row: 1 }, en)).toBe('row 1: "skills" must be an object');
    expect(playerImportIssueText({ code: 'skillsUnknownKey', row: 1, key: 'made_up' }, en)).toBe('row 1: "skills" has an unknown key "made_up"');
    expect(playerImportIssueText({ code: 'skillRange', row: 1, key: 'serve' }, en)).toBe(
      'row 1: "skills.serve" must be a number from 1 to 10, or null'
    );
  });

  it('maps the same codes to Italian', () => {
    expect(playerImportIssueText({ code: 'dobFormat', row: 4 }, itCatalog)).toBe('riga 4: "dob" deve essere AAAA-MM-GG');
    expect(playerImportIssueText({ code: 'positionInvalid', row: 6, allowed: ['S', 'OH'] }, itCatalog)).toBe(
      'riga 6: "positionCategory" deve essere uno tra S, OH'
    );
  });
});
