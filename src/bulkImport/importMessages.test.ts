import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { parseIssueText } from './importMessages';

describe('parseIssueText', () => {
  it('keeps the English wording of every JSON parse issue', () => {
    expect(parseIssueText({ code: 'blank' }, en)).toBe('paste or upload some JSON first');
    expect(parseIssueText({ code: 'invalidJson', message: 'boom' }, en)).toBe('that is not valid JSON: boom');
    expect(parseIssueText({ code: 'notArray' }, en)).toBe('the top level must be a JSON array (square brackets)');
    expect(parseIssueText({ code: 'empty' }, en)).toBe('the array is empty — nothing to import');
    expect(parseIssueText({ code: 'tooMany', max: 100 }, en)).toBe('import is limited to 100 entries at a time; split the file into smaller batches');
  });

  it('maps the same codes to Italian', () => {
    expect(parseIssueText({ code: 'tooMany', max: 100 }, itCatalog)).toContain('100');
    expect(parseIssueText({ code: 'blank' }, itCatalog)).not.toBe(parseIssueText({ code: 'blank' }, en));
  });
});
