import type { Catalog } from '../i18n/catalog';
import type { TrainingImportIssue } from './trainingsImport';

/** The text for one training-import problem in the active language. */
export function trainingImportIssueText(issue: TrainingImportIssue, t: Catalog): string {
  const m = t.trainings.import;
  switch (issue.code) {
    case 'notObject':
      return m.notObject(issue.row);
    case 'nameRequired':
      return m.nameRequired(issue.row);
    case 'descriptionText':
      return m.descriptionText(issue.row);
    case 'ageGroupText':
      return m.ageGroupText(issue.row);
    case 'suggestedPlayersRange':
      return m.suggestedPlayersRange(issue.row, issue.min, issue.max);
    case 'targetsInvalid':
      return m.targetsInvalid(issue.row, issue.options.join(', '));
    case 'exercisesNotArray':
      return m.exercisesNotArray(issue.row);
    case 'tooManyExercises':
      return m.tooManyExercises(issue.row, issue.max);
    case 'exerciseNotObject':
      return m.exerciseNotObject(issue.row, issue.exercise);
    case 'exerciseNameRequired':
      return m.exerciseNameRequired(issue.row, issue.exercise);
    case 'exerciseDuration':
      return m.exerciseDuration(issue.row, issue.exercise);
    case 'exerciseNotFound':
      return m.exerciseNotFound(issue.row, issue.name);
    case 'exerciseAmbiguous':
      return m.exerciseAmbiguous(issue.row, issue.name, issue.count);
    case 'tooManyNames':
      return m.tooManyNames(issue.max);
  }
}
