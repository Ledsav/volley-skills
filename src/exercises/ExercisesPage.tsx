import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { countTrainingsUsingExercise, deleteExercise, listExercises } from './exercisesApi';
import { ExerciseFormDialog } from './ExerciseFormDialog';

const CATEGORY_LABEL: Record<ExerciseCategory, string> = Object.fromEntries(
  EXERCISE_CATEGORIES.map((c) => [c.key, c.label])
) as Record<ExerciseCategory, string>;

// Sentinel for askDelete when the usage count read fails: the confirm dialog
// still opens, but the message says the count could not be determined.
const USAGE_UNKNOWN = -1;

export function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; exercise: Exercise } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exercise: Exercise; usageCount: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadFirstPage() {
    const page = await listExercises(null, category || null);
    setExercises(page.exercises);
    setLastDoc(page.lastDoc);
    setHasMore(page.exercises.length > 0 && page.lastDoc !== null);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listExercises(lastDoc, category || null);
    setExercises((current) => [...current, ...page.exercises]);
    setLastDoc(page.lastDoc);
    setHasMore(page.exercises.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    setError(null);
    setLoaded(false);
    loadFirstPage().catch(() => setError('Could not load exercises. Please refresh the page.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function askDelete(exercise: Exercise) {
    setDeleteError(null);
    let usageCount = USAGE_UNKNOWN;
    try {
      usageCount = await countTrainingsUsingExercise(exercise.id);
    } catch {
      usageCount = USAGE_UNKNOWN;
    }
    setPendingDelete({ exercise, usageCount });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExercise(pendingDelete.exercise.id);
    } catch {
      setDeleteError('Could not delete the exercise. Please try again.');
      return;
    }
    setPendingDelete(null);
    void loadFirstPage();
  }

  return (
    <div className="mx-auto max-w-2xl bg-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Exercises</h1>
        <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'new' })}>
          New exercise
        </Button>
      </div>

      <label htmlFor="category-filter" className="mr-2 text-sm text-slate">
        Category
      </label>
      <select
        id="category-filter"
        value={category}
        onChange={(e) => setCategory(e.target.value as ExerciseCategory | '')}
        className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
      >
        <option value="">All categories</option>
        {EXERCISE_CATEGORIES.map((c) => (
          <option key={c.key} value={c.key}>
            {c.label}
          </option>
        ))}
      </select>

      {error && (
        <p role="alert" className="mb-4 text-red">
          {error}
        </p>
      )}

      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        {loaded && exercises.length === 0 && <p className="p-4 text-slate">No exercises yet.</p>}
        {exercises.map((exercise) => (
          <div key={exercise.id} className="flex items-start justify-between gap-4 p-4">
            <button
              type="button"
              onClick={() => setDialog({ mode: 'edit', exercise })}
              className="text-left"
            >
              <span className="font-medium text-ink">{exercise.name}</span>
              <span className="ml-2 rounded-sm bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                {CATEGORY_LABEL[exercise.category]}
              </span>
              {exercise.description && (
                <p className="mt-1 line-clamp-1 text-sm text-slate">{exercise.description}</p>
              )}
            </button>
            <Button variant="ghost" size="sm" onClick={() => void askDelete(exercise)}>
              Delete
            </Button>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadMore().catch(() => setError('Could not load more exercises. Please try again.'))}
          className="mt-4"
        >
          Load more
        </Button>
      )}

      {dialog && (
        <ExerciseFormDialog
          exercise={dialog.mode === 'edit' ? dialog.exercise : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void loadFirstPage();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.exercise.name}?`}
          message={
            pendingDelete.usageCount === USAGE_UNKNOWN
              ? 'The number of trainings using this exercise could not be determined. Deleting it may leave some trainings with a missing exercise entry.'
              : pendingDelete.usageCount > 0
                ? `This exercise is used in ${pendingDelete.usageCount} training(s). Deleting it will leave those trainings with a missing exercise entry.`
                : 'This exercise is not used in any training.'
          }
          confirmLabel="Yes, delete exercise"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
