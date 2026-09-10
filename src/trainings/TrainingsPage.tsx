import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import { useDebouncedValue } from '../components/useDebouncedValue';
import type { Training } from '../types/training';
import {
  bulkCreateTrainings,
  deleteTraining,
  findTrainingByBusinessId,
  listTrainings,
  resolveExerciseNames,
} from './trainingsApi';
import {
  TRAINING_IMPORT_EXAMPLE,
  collectExerciseNames,
  validateTrainingRows,
} from './trainingsImport';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';

export function TrainingsPage() {
  const [searchParams] = useSearchParams();
  const { firebaseUser } = useAuth();
  const [showImport, setShowImport] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [businessId, setBusinessId] = useState(() => searchParams.get('businessId') ?? '');
  // Free-text filters: debounce so a query fires once the user stops typing,
  // not on every keystroke.
  const debouncedAgeGroup = useDebouncedValue(ageGroup, 350);
  const debouncedBusinessId = useDebouncedValue(businessId, 350);
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; training: Training } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Training | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (debouncedBusinessId.trim()) {
      const found = await findTrainingByBusinessId(debouncedBusinessId.trim());
      setTrainings(found ? [found] : []);
      setLastDoc(null);
      setHasMore(false);
      setLoaded(true);
      return;
    }
    const page = await listTrainings(
      null,
      debouncedAgeGroup.trim() ? { ageGroupTarget: debouncedAgeGroup.trim() } : {}
    );
    setTrainings(page.trainings);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listTrainings(
      lastDoc,
      debouncedAgeGroup.trim() ? { ageGroupTarget: debouncedAgeGroup.trim() } : {}
    );
    setTrainings((current) => [...current, ...page.trainings]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    setError(null);
    setLoaded(false);
    load().catch(() => setError('Could not load trainings. Please refresh the page.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAgeGroup, debouncedBusinessId]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteTraining(pendingDelete.id);
    } catch {
      setDeleteError('Could not delete the training. Please try again.');
      return;
    }
    setPendingDelete(null);
    void load();
  }

  return (
    <div className="w-full bg-bg p-4 sm:p-6 lg:p-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Trainings</h1>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setShowImport(true)}
          >
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => setDialog({ mode: 'new' })}
          >
            New training
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <label htmlFor="filter-age" className="mb-1 block text-sm text-slate">
            Age group
          </label>
          <Input
            id="filter-age"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="w-full sm:w-40"
          />
        </div>
        <div className="w-full sm:w-auto">
          <label htmlFor="filter-bid" className="mb-1 block text-sm text-slate">
            Business ID
          </label>
          <Input
            id="filter-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
            className="w-full sm:w-40"
          />
        </div>
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
        {loaded && trainings.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-4 text-slate shadow-card sm:rounded-none sm:border-0 sm:shadow-none">
            No trainings found.
          </p>
        )}
        {trainings.map((training) => (
          <div
            key={training.id}
            role="button"
            tabIndex={0}
            onClick={() => setDialog({ mode: 'edit', training })}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setDialog({ mode: 'edit', training });
              }
            }}
            className="flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-bg sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none"
          >
            <div className="min-w-0 text-left">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium tabular-nums text-ink">{training.businessId}</span>
                <span className="text-ink">{training.name}</span>
              </div>
              <p className="mt-1 text-sm text-slate">
                {training.ageGroupTarget || '—'} · {training.exercises.length} exercise(s) ·{' '}
                {training.exercises.reduce((s, e) => s + e.durationMinutes, 0)} min
              </p>
            </div>
            <div className="flex justify-end border-t border-border pt-3 sm:border-0 sm:pt-0">
              <Button
                variant="dangerGhost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteError(null);
                  setPendingDelete(training);
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
          onClick={() => loadMore().catch(() => setError('Could not load more trainings. Please try again.'))}
          className="mt-4"
        >
          Load more
        </Button>
      )}

      {dialog && (
        <TrainingBuilderDialog
          training={dialog.mode === 'edit' ? dialog.training : undefined}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      )}

      {showImport && firebaseUser && (
        <BulkImportDialog
          title="Import trainings"
          hint="Exercises are matched by name against the existing library."
          exampleJson={TRAINING_IMPORT_EXAMPLE}
          validate={async (rows) => {
            const names = collectExerciseNames(rows);
            if (names.length > 500) {
              return {
                inputs: [],
                errors: [
                  'too many distinct exercise names to resolve at once (max 500) — split the import into smaller files',
                ],
              };
            }
            const map = await resolveExerciseNames(names);
            return validateTrainingRows(rows, map);
          }}
          commit={(inputs) => bulkCreateTrainings(inputs, firebaseUser.uid)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            setNotice(`Imported ${n} training${n === 1 ? '' : 's'}.`);
            window.setTimeout(() => setNotice(null), 4000);
            void load();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.businessId}?`}
          message="Past calendar entries for this training keep their label but will no longer link to it."
          confirmLabel="Yes, delete training"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
