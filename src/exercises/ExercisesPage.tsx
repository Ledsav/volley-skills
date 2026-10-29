import { usePageMeta } from '../layout/usePageMeta';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import { useTakePendingAction } from '../search/pendingAction';
import type { MenuItem } from '../components/Menu';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { ExerciseDraftDialog } from '../aiDraft/ExerciseDraftDialog';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FilterChips } from '../components/Chip';
import { SkeletonBlock } from '../components/Skeleton';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../types/exercise';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import { bulkCreateExercises, countTrainingsUsingExercise, deleteExercise, getExercise, listExercises } from './exercisesApi';
import { EXERCISE_IMPORT_EXAMPLE, validateExerciseRows } from './exercisesImport';
import { exerciseImportIssueText } from './exercisesImportMessages';
import { useNotify, useUndoable } from '../components/Notice';
import { ExerciseRow } from './ExerciseRow';
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
  const undoable = useUndoable();
  const mounted = useRef(true);
  const checkingDelete = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useTakePendingAction('new-exercise', () => setDialog({ mode: 'new' }));
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<ExerciseCategory | ''>('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; exercise: Exercise } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ exercise: Exercise; usageCount: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

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

  // Opened from a search result (?exercise=<id>): load it once, open its sheet, drop the param.
  const [searchParams, setSearchParams] = useSearchParams();
  const exerciseParam = searchParams.get('exercise');
  useEffect(() => {
    if (!exerciseParam) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('exercise');
        return next;
      },
      { replace: true },
    );
    getExercise(exerciseParam)
      .then((found) => {
        if (found) setDialog({ mode: 'edit', exercise: found });
      })
      .catch(() => {});
  }, [exerciseParam, setSearchParams]);

  function setHiddenId(id: string, value: boolean) {
    setHidden((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function dropFromList(id: string) {
    setExercises((current) => current.filter((e) => e.id !== id));
    setHiddenId(id, false);
  }

  // Unused exercise: the card leaves at once and the delete runs when the Undo notice expires.
  function deleteWithUndo(exercise: Exercise) {
    setHiddenId(exercise.id, true);
    undoable({
      message: p.deletedNotice(exercise.name),
      commit: async () => {
        await deleteExercise(exercise.id);
        if (mounted.current) dropFromList(exercise.id);
      },
      onUndo: () => {
        if (mounted.current) setHiddenId(exercise.id, false);
      },
      onCommitError: () => {
        if (mounted.current) {
          setHiddenId(exercise.id, false);
          setDeleteError(p.deleteError);
        }
      },
    });
  }

  // A used exercise is a high-impact delete: it keeps the confirm naming the number of trainings.
  async function requestDelete(exercise: Exercise) {
    // A second Delete on the same row while its usage count is being read does nothing.
    if (checkingDelete.current.has(exercise.id)) return;
    checkingDelete.current.add(exercise.id);
    setDeleteError(null);
    let usageCount = USAGE_UNKNOWN;
    try {
      usageCount = await countTrainingsUsingExercise(exercise.id);
    } catch {
      usageCount = USAGE_UNKNOWN;
    }
    checkingDelete.current.delete(exercise.id);
    if (usageCount === 0) deleteWithUndo(exercise);
    else setPendingDelete({ exercise, usageCount });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteExercise(pendingDelete.exercise.id);
    } catch {
      setDeleteError(p.deleteError);
      return;
    }
    dropFromList(pendingDelete.exercise.id);
    setPendingDelete(null);
  }

  const visible = exercises.filter((e) => !hidden.has(e.id));

  const moreItems: MenuItem[] = [
    { kind: 'action', label: p.import, onSelect: () => setShowImport(true) },
    ...(aiEnabled ? [{ kind: 'action' as const, label: p.draftWithAi, icon: <Sparkles size={16} aria-hidden="true" />, onSelect: () => setShowDraft(true) }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={p.title}
        mainAction={{ label: p.newExercise, icon: Plus, onSelect: () => setDialog({ mode: 'new' }) }}
        more={moreItems}
        className="mb-4"
      />

      <FilterChips
        label={p.filterByCategory}
        options={[{ id: '' as ExerciseCategory | '', label: p.all }, ...EXERCISE_CATEGORIES.map((c) => ({ id: c.key as ExerciseCategory | '', label: lb.exerciseCategory[c.key] }))]}
        value={category}
        onChange={setCategory}
        className="mb-4"
      />

      {error && (
        <p role="alert" className="mb-4 text-red-strong">
          {error}
        </p>
      )}
      {deleteError && !pendingDelete && (
        <p role="alert" className="mb-4 text-red-strong">
          {deleteError}
        </p>
      )}

      {!loaded && !error && (
        <div role="status" aria-label={t.common.loading} className="space-y-px">
          <SkeletonBlock className="h-[72px]" />
          <SkeletonBlock className="h-[72px]" />
          <SkeletonBlock className="h-[72px]" />
        </div>
      )}

      {loaded && visible.length === 0 && (
        <p className="rounded-lg bg-surface p-4 text-ink-2 shadow-card">{p.none}</p>
      )}
      {visible.length > 0 && (
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:rounded-none md:bg-transparent md:shadow-none lg:grid-cols-4">
          {visible.map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              onOpen={() => setDialog({ mode: 'edit', exercise })}
              onDelete={() => void requestDelete(exercise)}
            />
          ))}
        </ul>
      )}

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
          message={pendingDelete.usageCount === USAGE_UNKNOWN ? p.usageUnknown : p.usedIn(pendingDelete.usageCount)}
          confirmLabel={p.confirmDelete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => {
            setPendingDelete(null);
            setDeleteError(null);
          }}
          error={deleteError}
        />
      )}
    </div>
  );
}
