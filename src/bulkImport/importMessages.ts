import type { Catalog } from '../i18n/catalog';
import type { ParseIssue } from './parseJsonArray';
import type { SizeIssue } from './types';

/** The text for a JSON-parse problem in the active language. */
export function parseIssueText(issue: ParseIssue, t: Catalog): string {
  const m = t.bulkImport.issues;
  switch (issue.code) {
    case 'blank':
      return m.blank;
    case 'invalidJson':
      return m.invalidJson(issue.message);
    case 'notArray':
      return m.notArray;
    case 'empty':
      return m.empty;
    case 'tooMany':
      return m.tooMany(issue.max);
    case 'tooLarge':
      return m.tooLarge(issue.max);
  }
}

/** The text for a row's field or list over its size cap, in the active language. */
export function sizeIssueText(issue: SizeIssue, t: Catalog): string {
  const m = t.bulkImport.issues;
  return issue.code === 'tooLong' ? m.fieldTooLong(issue.row, issue.field, issue.max) : m.listTooLong(issue.row, issue.field, issue.max);
}
