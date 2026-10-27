import type { Catalog } from '../i18n/catalog';
import type { DraftSaveIssue } from './saveDrafts';
import type { DraftIssue } from './types';

type T = Catalog['aiDraft'];

/** Text for a repair note under a proposal. */
export function draftIssueText(issue: DraftIssue, t: T): string {
  switch (issue.code) {
    case 'pickCategory':
    case 'noDiagram':
    case 'diagramUnusable':
      return t.issues[issue.code];
    default:
      return t.issues[issue.code](issue.n);
  }
}

/** Stable React key for an issue. */
export const draftIssueKey = (issue: DraftIssue): string => ('n' in issue ? `${issue.code}-${issue.n}` : issue.code);

/** Text for a failed save, with the exercises that were added before it failed. */
export function draftSaveErrorText(issue: DraftSaveIssue, t: T): string {
  const e = t.saveErrors;
  if (!('name' in issue)) return e[issue.code];
  const base = e[issue.code](issue.name);
  return issue.added.length ? `${base} ${e.alreadyAdded(issue.added.join(', '))}` : base;
}
