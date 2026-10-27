import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { teamImportIssueText } from './teamsImportMessages';

describe('import issue texts', () => {
  it('keeps the English wording of every team import issue', () => {
    expect(teamImportIssueText({ code: 'notObject', row: 1 }, en)).toBe('row 1: each entry must be a JSON object');
    expect(teamImportIssueText({ code: 'nameRequired', row: 2 }, en)).toBe('row 2: "name" is required');
    expect(teamImportIssueText({ code: 'genderRequired', row: 3 }, en)).toBe('row 3: "gender" is required (women, men or mixed)');
    expect(teamImportIssueText({ code: 'genderInvalid', row: 4 }, en)).toBe('row 4: "gender" must be women, men or mixed');
    expect(teamImportIssueText({ code: 'mustBeText', row: 5, field: 'season' }, en)).toBe('row 5: "season" must be text');
  });

  it('maps the same codes to Italian', () => {
    expect(teamImportIssueText({ code: 'genderInvalid', row: 2 }, itCatalog)).toBe('riga 2: "gender" deve essere women, men o mixed');
  });
});
