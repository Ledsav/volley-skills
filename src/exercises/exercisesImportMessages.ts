import type { Catalog } from '../i18n/catalog';
import { sizeIssueText } from '../bulkImport/importMessages';
import { sceneIssueText } from '../diagrams/sceneIssueText';
import type { ExerciseImportIssue } from './exercisesImport';

/** The text for one exercise-import problem in the active language. */
export function exerciseImportIssueText(issue: ExerciseImportIssue, t: Catalog): string {
  const m = t.exercises.import;
  switch (issue.code) {
    case 'tooLong':
    case 'listTooLong':
      return sizeIssueText(issue, t);
    case 'notObject':
      return m.notObject(issue.row);
    case 'nameRequired':
      return m.nameRequired(issue.row);
    case 'categoryInvalid':
      return m.categoryInvalid(issue.row, issue.options.join(', '));
    case 'descriptionText':
      return m.descriptionText(issue.row);
    case 'minPlayersRange':
      return m.minPlayersRange(issue.row, issue.min, issue.max);
    case 'diagramsNotArray':
      return m.diagramsNotArray(issue.row);
    case 'tooManyDiagrams':
      return m.tooManyDiagrams(issue.row, issue.max);
    case 'diagramNotObject':
      return m.diagramNotObject(issue.row, issue.diagram);
    case 'diagramTitle':
      return m.diagramTitle(issue.row, issue.diagram, issue.max);
    case 'diagramScene':
      return m.diagramScene(issue.row, issue.diagram, sceneIssueText(issue.scene, t));
  }
}
