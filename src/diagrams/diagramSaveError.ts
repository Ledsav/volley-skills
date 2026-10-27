import type { Catalog } from '../i18n/catalog';
import { en } from '../i18n/en';
import { sceneIssueText } from './sceneIssueText';
import type { SceneIssue } from './parseScene';

/** Why a diagram set could not be written; `diagramSaveErrorText` turns it into text. */
export type DiagramSaveIssue =
  | { code: 'titleLength'; title: string }
  | { code: 'invalidScene'; title: string; scene: SceneIssue };

/** Carries the issue for the UI; its own `message` is English, for logs and tests. */
export class DiagramSaveError extends Error {
  constructor(readonly issue: DiagramSaveIssue) {
    super(diagramSaveErrorText(issue, en));
    this.name = 'DiagramSaveError';
  }
}

export function diagramSaveErrorText(issue: DiagramSaveIssue, t: Catalog): string {
  const m = t.diagrams.saveError;
  return issue.code === 'titleLength' ? m.titleLength(issue.title) : m.invalidScene(issue.title, sceneIssueText(issue.scene, t));
}
