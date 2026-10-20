import { saveDiagramSet } from '../diagrams/diagramsApi';
import { createExercise } from '../exercises/exercisesApi';
import { createTraining } from '../trainings/trainingsApi';
import type { NewTrainingInput } from '../types/training';
import type { ExerciseDraft, TrainingDraft } from './types';

export class DraftSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DraftSaveError';
  }
}

export const DRAFT_DIAGRAM_TITLE = 'AI draft';

/**
 * Saves drafts in order and stops at the first failure. `created` maps draft key → exercise id and
 * outlives a failed call, so pressing Save again never creates the same exercise twice.
 */
export async function saveExerciseDrafts(drafts: ExerciseDraft[], uid: string, created: Map<string, string>): Promise<string[]> {
  const ids: string[] = [];
  const addedNow: string[] = [];
  const withAdded = (msg: string) => (addedNow.length ? `${msg} Already added: ${addedNow.join(', ')}.` : msg);
  for (const d of drafts) {
    const existing = created.get(d.key);
    if (existing) {
      ids.push(existing);
      continue;
    }
    if (!d.category) throw new DraftSaveError(withAdded(`“${d.name}” needs a category.`));
    let id: string;
    try {
      id = await createExercise({ name: d.name, description: d.description, category: d.category, minPlayers: d.minPlayers ?? undefined }, uid);
    } catch {
      throw new DraftSaveError(withAdded(`Could not add “${d.name}”.`));
    }
    created.set(d.key, id);
    ids.push(id);
    if (d.scene) {
      try {
        await saveDiagramSet(
          id,
          { creates: [{ tempId: 'ai-0', title: DRAFT_DIAGRAM_TITLE, order: 0, scene: d.scene }], updates: [], deletes: [] },
          uid,
        );
      } catch {
        throw new DraftSaveError(withAdded(`“${d.name}” was added without its diagram — add one in the diagram editor.`));
      }
    }
    addedNow.push(d.name);
  }
  return ids;
}

/** Call after the draft's new exercises are saved (their ids are in `created`). */
export function trainingDraftToInput(draft: TrainingDraft, created: Map<string, string>): NewTrainingInput {
  return {
    name: draft.name.trim(),
    description: draft.description,
    ageGroupTarget: draft.ageGroupTarget,
    targets: draft.targets.length > 0 ? draft.targets : undefined,
    suggestedPlayers: draft.suggestedPlayers ?? undefined,
    exercises: draft.steps.map((s, i) => ({
      exerciseId: s.kind === 'library' ? s.exerciseId : (created.get(s.exercise.key) as string),
      order: i + 1,
      durationMinutes: s.minutes,
    })),
  };
}

export function newExercisesOf(draft: TrainingDraft): ExerciseDraft[] {
  return draft.steps.flatMap((s) => (s.kind === 'new' ? [s.exercise] : []));
}

export async function saveTrainingDraft(draft: TrainingDraft, uid: string, created: Map<string, string>) {
  const fresh = newExercisesOf(draft);
  await saveExerciseDrafts(fresh, uid, created);
  try {
    return await createTraining(trainingDraftToInput(draft, created), uid);
  } catch {
    throw new DraftSaveError(
      fresh.length ? 'The new exercises were saved, but the training was not. Try Save again.' : 'Could not save the training. Please try again.',
    );
  }
}
