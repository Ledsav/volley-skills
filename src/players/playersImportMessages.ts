import type { Catalog } from '../i18n/catalog';
import type { PlayerImportIssue } from './playersImport';

/** The text for one player-import problem in the active language. */
export function playerImportIssueText(issue: PlayerImportIssue, t: Catalog): string {
  const m = t.players.import;
  switch (issue.code) {
    case 'notObject':
      return m.notObject(issue.row);
    case 'numberRequired':
      return m.numberRequired(issue.row);
    case 'fullNameRequired':
      return m.fullNameRequired(issue.row);
    case 'dobFormat':
      return m.dobFormat(issue.row);
    case 'mustBeText':
      return m.mustBeText(issue.row, issue.field);
    case 'positionInvalid':
      return m.positionInvalid(issue.row, issue.allowed.join(', '));
    case 'shirtSizeInvalid':
      return m.shirtSizeInvalid(issue.row, issue.allowed.join(', '));
    case 'guardiansNotArray':
      return m.guardiansNotArray(issue.row);
    case 'guardianNotObject':
      return m.guardianNotObject(issue.row, issue.guardian);
    case 'guardianRelation':
      return m.guardianRelation(issue.row, issue.guardian);
    case 'guardianNameRequired':
      return m.guardianNameRequired(issue.row, issue.guardian);
    case 'skillsNotObject':
      return m.skillsNotObject(issue.row);
    case 'skillsUnknownKey':
      return m.skillsUnknownKey(issue.row, issue.key);
    case 'skillRange':
      return m.skillRange(issue.row, issue.key);
  }
}
