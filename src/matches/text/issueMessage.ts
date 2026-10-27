import type { Catalog } from '../../i18n/catalog';
import type { BatchIssue } from './textScout';
import type { Skill } from '../../types/match';

type Labels = { skill: Record<Skill, string> };

/** Words a batch issue for the coach in the active language. */
export function issueMessage(issue: BatchIssue, t: { textScout: Catalog['textScout']; labels: Labels }): string {
  const m = t.textScout.issues;
  switch (issue.kind) {
    case 'unknownNumber':
      return m.unknownNumber(issue.number);
    case 'missingGrade':
      return m.missingGrade(issue.number, t.labels.skill[issue.skill]);
    case 'invalidGrade':
      return m.invalidGrade(t.labels.skill[issue.skill], issue.grade);
    case 'conflictingWinner':
      return m.conflictingWinner(issue.actions, issue.notes);
    case 'noWinner':
      return m.noWinner;
  }
}
