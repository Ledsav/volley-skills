import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import type { Training } from '../types/training';
import { deleteTraining, findTrainingByBusinessId, listTrainings } from './trainingsApi';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';

export function TrainingsPage() {
  const [searchParams] = useSearchParams();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [businessId, setBusinessId] = useState(() => searchParams.get('businessId') ?? '');
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; training: Training } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Training | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (businessId.trim()) {
      const found = await findTrainingByBusinessId(businessId.trim());
      setTrainings(found ? [found] : []);
      setLastDoc(null);
      setHasMore(false);
      setLoaded(true);
      return;
    }
    const page = await listTrainings(null, ageGroup.trim() ? { ageGroupTarget: ageGroup.trim() } : {});
    setTrainings(page.trainings);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listTrainings(lastDoc, ageGroup.trim() ? { ageGroupTarget: ageGroup.trim() } : {});
    setTrainings((current) => [...current, ...page.trainings]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    setError(null);
    setLoaded(false);
    load().catch(() => setError('Could not load trainings. Please refresh the page.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, businessId]);

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
    <div className="w-full bg-bg p-6 lg:p-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink">Trainings</h1>
        <Button variant="primary" size="sm" onClick={() => setDialog({ mode: 'new' })}>
          New training
        </Button>
      </div>

      <div className="mb-4 flex gap-3">
        <div>
          <label htmlFor="filter-age" className="mb-1 block text-sm text-slate">
            Age group
          </label>
          <Input id="filter-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} className="w-40" />
        </div>
        <div>
          <label htmlFor="filter-bid" className="mb-1 block text-sm text-slate">
            Business ID
          </label>
          <Input
            id="filter-bid"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            placeholder="TR-0007"
            className="w-40"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-red">
          {error}
        </p>
      )}

      <div className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
        {loaded && trainings.length === 0 && <p className="p-4 text-slate">No trainings found.</p>}
        {trainings.map((training) => (
          <div key={training.id} className="flex items-center justify-between gap-4 p-4">
            <button type="button" onClick={() => setDialog({ mode: 'edit', training })} className="text-left">
              <span className="font-medium tabular-nums text-ink">{training.businessId}</span>
              <span className="ml-2 text-ink">{training.name}</span>
              <p className="mt-1 text-sm text-slate">
                {training.ageGroupTarget || '—'} · {training.exercises.length} exercise(s) ·{' '}
                {training.exercises.reduce((s, e) => s + e.durationMinutes, 0)} min
              </p>
            </button>
            <Button variant="ghost" size="sm" onClick={() => { setDeleteError(null); setPendingDelete(training); }}>
              Delete
            </Button>
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
