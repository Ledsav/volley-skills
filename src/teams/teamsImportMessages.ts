import type { Catalog } from '../i18n/catalog';
import type { TeamImportIssue } from './teamsImport';

/** The text for one team-import problem in the active language. */
export function teamImportIssueText(issue: TeamImportIssue, t: Catalog): string {
  const m = t.teams.import;
  switch (issue.code) {
    case 'notObject':
      return m.notObject(issue.row);
    case 'nameRequired':
      return m.nameRequired(issue.row);
    case 'genderRequired':
      return m.genderRequired(issue.row);
    case 'genderInvalid':
      return m.genderInvalid(issue.row);
    case 'mustBeText':
      return m.mustBeText(issue.row, issue.field);
  }
}
