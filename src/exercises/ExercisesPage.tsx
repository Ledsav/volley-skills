import { usePageMeta } from '../layout/usePageMeta';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { ExerciseDraftDialog } from '../aiDraft/ExerciseDraftDialog';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiagramThumbnail } from '../diagrams/DiagramThumbnail';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import { bulkCreateExercises, countTrainingsUsingExercise, deleteExercise, listExercises } from './exercisesApi';
import { EXERCISE_IMPORT_EXAMPLE, validateExerciseRows } from './exercisesImport';
import { exerciseImportIssueText } from './exercisesImportMessages';
import { useNotify } from '../components/Notice';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';

// Sentinel for askDelete when the usage count read fails: the confirm dialog
// still opens, but the message says the count could not be determined.
const USAGE_UNKNOWN = -1;

export function ExercisesPage() {
  const t = useT();
  const lb = t.labels;
  const p = t.exercises.page;
  usePageMeta({ title: p.title });
  const { firebaseUser } = useAuth();
  const { aiEnabled } = useClubFeatures();
  const [showImport, setShowImport] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const notify = useNotify();
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
    loadFirstPage().catch(() => setError(p.loadError));
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
      setDeleteError(p.deleteError);
      return;
    }
    setPendingDelete(null);
    void loadFirstPage();
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={p.title}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setShowImport(true)}
            >
              {p.import}
            </Button>
            {aiEnabled && (
              <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setShowDraft(true)}>
                <Sparkles size={16} aria-hidden="true" />
                {p.draftWithAi}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setDialog({ mode: 'new' })}
            >
              {p.newExercise}
            </Button>
          </>
        }
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={p.filterByCategory}>
        <button
          type="button"
          aria-pressed={category === ''}
          onClick={() => setCategory('')}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            category === '' ? 'bg-blue text-white' : 'border border-border bg-surface text-slate hover:bg-bg'
          }`}
        >
          {p.all}
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
            {lb.exerciseCategory[c.key]}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mb-4 text-red">
          {error}
        </p>
      )}


      {/* Mobile: a separated card per entry (own border + shadow). Tablet/desktop:
          one bordered container with hairline dividers between rows. */}
      <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-border sm:rounded-lg sm:border sm:border-border sm:bg-surface sm:shadow-card">
        {loaded && exercises.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-4 text-slate shadow-card sm:rounded-none sm:border-0 sm:shadow-none">
            {p.none}
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
              <div onClick={(e) => e.stopPropagation()}>
                <DiagramThumbnail exerciseId={exercise.id} />
              </div>
              <div className="min-w-0 text-left">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-ink">{exercise.name}</span>
                  <span className="rounded-sm bg-blue/10 px-2 py-0.5 text-xs font-medium text-blue">
                    {lb.exerciseCategory[exercise.category]}
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
                {t.common.delete}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => loadMore().catch(() => setError(p.loadMoreError))}
          className="mt-4"
        >
          {p.loadMore}
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

      {aiEnabled && showDraft && (
        <ExerciseDraftDialog
          onClose={() => setShowDraft(false)}
          onSaved={(n) => {
            setShowDraft(false);
            notify(p.added(n));
            void loadFirstPage();
          }}
        />
      )}

      {showImport && firebaseUser && (
        <BulkImportDialog
          title={p.importTitle}
          formatIssue={(issue) => exerciseImportIssueText(issue, t)}
          exampleJson={EXERCISE_IMPORT_EXAMPLE}
          validate={validateExerciseRows}
          commit={(inputs) => bulkCreateExercises(inputs, firebaseUser.uid)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            notify(p.imported(n));
            void loadFirstPage();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={p.deleteTitle(pendingDelete.exercise.name)}
          message={
            pendingDelete.usageCount === USAGE_UNKNOWN
              ? p.usageUnknown
              : pendingDelete.usageCount > 0
                ? p.usedIn(pendingDelete.usageCount)
                : p.notUsed
          }
          confirmLabel={p.confirmDelete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
