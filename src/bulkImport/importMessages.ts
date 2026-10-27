import type { Catalog } from '../i18n/catalog';
import type { ParseIssue } from './parseJsonArray';

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
  }
}
