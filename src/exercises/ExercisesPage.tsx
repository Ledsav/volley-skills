import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import { bulkCreateExercises, countTrainingsUsingExercise, deleteExercise, listExercises } from './exercisesApi';
import { EXERCISE_IMPORT_EXAMPLE, validateExerciseRows } from './exercisesImport';

const CATEGORY_LABEL: Record<ExerciseCategory, string> = Object.fromEntries(
  EXERCISE_CATEGORIES.map((c) => [c.key, c.label])
) as Record<ExerciseCategory, string>;

// Sentinel for askDelete when the usage count read fails: the confirm dialog
// still opens, but the message says the count could not be determined.
const USAGE_UNKNOWN = -1;

export function ExercisesPage() {
  const { firebaseUser } = useAuth();
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
    setHasMore(page.hasMore);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listExercises(lastDoc, category || null);
    setExercises((current) => [...current, ...page.exercises]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
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
    <div className="w-full bg-bg p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Exercises</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            Import
          </Button>
          <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'new' })}>
            New exercise
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button
          type="button"
          aria-pressed={category === ''}
          onClick={() => setCategory('')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            category === '' ? 'bg-blue text-white' : 'border border-border bg-surface text-slate hover:bg-bg'
          }`}
        >
          All
        </button>
        {EXERCISE_CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={category === c.key}
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              category === c.key ? 'bg-blue text-white' : 'border border-border bg-surface text-slate hover:bg-bg'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 text-red">
          {error}
        </p>
      )}

      {notice && <p className="mb-4 text-sm text-green">{notice}</p>}

      {/* Mobile: a separated card per entry (own border + shadow). Tablet/desktop:
          one bordered container with hairline dividers between rows. */}
      <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-border sm:rounded-lg sm:border sm:border-border sm:bg-surface sm:shadow-card">
        {loaded && exercises.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-4 text-slate shadow-card sm:rounded-none sm:border-0 sm:shadow-none">
            No exercises yet.
          </p>
        )}
        {exercises.map((exercise) => (
          <div
            key={exercise.id}
            role="button"
            tabIndex={0}
            onClick={() => setDialog({ mode: 'edit', exercise })}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setDialog({ mode: 'edit', exercise });
              }
            }}
            className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-bg sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none"
          >
            <div className="flex items-start gap-3">
              <DiagramThumbnail exerciseId={exercise.id} />
              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-ink">{exercise.name}</span>
                  <span className="rounded-sm bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                    {CATEGORY_LABEL[exercise.category]}
                  </span>
                </div>
                {exercise.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate sm:line-clamp-1">
                    {exercise.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end border-t border-border pt-3 sm:border-0 sm:pt-0">
              <Button
                variant="dangerGhost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void askDelete(exercise);
                }}
              >
                Delete
              </Button>
            </div>
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

      {showImport && firebaseUser && (
        <BulkImportDialog
          title="Import exercises"
          exampleJson={EXERCISE_IMPORT_EXAMPLE}
          validate={validateExerciseRows}
          commit={(inputs) => bulkCreateExercises(inputs, firebaseUser.uid)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            setNotice(`Imported ${n} exercise${n === 1 ? '' : 's'}.`);
            window.setTimeout(() => setNotice(null), 4000);
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
