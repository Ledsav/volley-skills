import type { Catalog } from '../i18n/catalog';
import type { SceneIssue } from './parseScene';

/** The text for one scene problem in the active language. */
export function sceneIssueText(issue: SceneIssue, t: Catalog): string {
  const m = t.diagrams.sceneIssue;
  switch (issue.code) {
    case 'notObject':
      return m.notObject;
    case 'unsupportedVersion':
      return m.unsupportedVersion;
    case 'badCourt':
      return m.badCourt;
    case 'itemsNotArray':
      return m.itemsNotArray;
    case 'tooManyItems':
      return m.tooManyItems(issue.max);
    case 'itemMissingField':
      return m.itemMissingField;
  }
}
