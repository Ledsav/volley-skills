import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Input } from '../components/Input';
import { useDebouncedValue } from '../components/useDebouncedValue';
import { Sparkles } from 'lucide-react';
import { TrainingDraftDialog } from '../aiDraft/TrainingDraftDialog';
import type { NewTrainingInput, Training } from '../types/training';
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
  MAX_IMPORT_EXERCISE_NAMES,
  type TrainingImportIssue,
} from './trainingsImport';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';
import { TrainingViewSheet } from './TrainingViewSheet';
import { getCalendarSession } from '../calendar/calendarApi';
import { useNotify } from '../components/Notice';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { trainingImportIssueText } from './trainingsImportMessages';

type TeamContext = { teamId: string; date: string; notes: string };

export function TrainingsPage() {
  const t = useT();
  const p = t.trainings.page;
  usePageMeta({ title: p.title });
  const [searchParams] = useSearchParams();
  const { firebaseUser } = useAuth();
  const { aiEnabled } = useClubFeatures();
  const [showImport, setShowImport] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const notify = useNotify();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [ageGroup, setAgeGroup] = useState('');
  const [businessId, setBusinessId] = useState(() => searchParams.get('businessId') ?? '');
  // Opened from a team's calendar session (?team=…&session=…): open that training with its team context, once.
  const sessionLink = useRef({ teamId: searchParams.get('team'), sessionId: searchParams.get('session'), opened: false });
  // Free-text filters: debounce so a query fires once the user stops typing,
  // not on every keystroke.
  const debouncedAgeGroup = useDebouncedValue(ageGroup, 350);
  const debouncedBusinessId = useDebouncedValue(businessId, 350);
  // Opening a training shows the read-only plan ('view'); editing from there
  // returns to the plan on cancel.
  const [dialog, setDialog] = useState<
    | { mode: 'new'; initial?: NewTrainingInput }
    | { mode: 'view'; training: Training; teamContext?: TeamContext }
    | { mode: 'edit'; training: Training; fromView: boolean; teamContext?: TeamContext }
    | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<Training | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (debouncedBusinessId.trim()) {
      const found = await findTrainingByBusinessId(debouncedBusinessId.trim());
      setTrainings(found ? [found] : []);
      const link = sessionLink.current;
      if (found && link.teamId && link.sessionId && !link.opened) {
        link.opened = true;
        const session = await getCalendarSession(link.teamId, link.sessionId).catch(() => null);
        if (session && session.trainingId === found.id) {
          setDialog({ mode: 'view', training: found, teamContext: { teamId: link.teamId, date: session.date, notes: session.notes ?? '' } });
        }
      }
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
    load().catch(() => setError(p.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAgeGroup, debouncedBusinessId]);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteTraining(pendingDelete.id);
    } catch {
      setDeleteError(p.deleteError);
      return;
    }
    setPendingDelete(null);
    void load();
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
              {p.newTraining}
            </Button>
          </>
        }
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <label htmlFor="filter-age" className="mb-1 block text-sm text-slate">
            {p.ageGroup}
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
            {p.businessId}
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


      {/* Mobile: a separated card per entry (own border + shadow). Tablet/desktop:
          one bordered container with hairline dividers between rows. */}
      <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-border sm:rounded-lg sm:border sm:border-border sm:bg-surface sm:shadow-card">
        {loaded && trainings.length === 0 && (
          <p className="rounded-lg border border-border bg-surface p-4 text-slate shadow-card sm:rounded-none sm:border-0 sm:shadow-none">
            {p.none}
          </p>
        )}
        {trainings.map((training) => (
          <div
            key={training.id}
            role="button"
            tabIndex={0}
            onClick={() => setDialog({ mode: 'view', training })}
            onKeyDown={(e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                setDialog({ mode: 'view', training });
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
                {p.summary(
                  training.ageGroupTarget || '—',
                  training.exercises.length,
                  training.exercises.reduce((s, e) => s + e.durationMinutes, 0),
                )}
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
                {p.delete}
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

      {dialog?.mode === 'view' && (
        <TrainingViewSheet
          training={dialog.training}
          onClose={() => setDialog(null)}
          teamContext={dialog.teamContext}
          onEdit={() => setDialog({ mode: 'edit', training: dialog.training, fromView: true, teamContext: dialog.teamContext })}
        />
      )}

      {dialog && dialog.mode !== 'view' && (
        <TrainingBuilderDialog
          training={dialog.mode === 'edit' ? dialog.training : undefined}
          initial={dialog.mode === 'new' ? dialog.initial : undefined}
          onClose={() =>
            setDialog(
              dialog.mode === 'edit' && dialog.fromView
                ? { mode: 'view', training: dialog.training, teamContext: dialog.teamContext }
                : null
            )
          }
          onSaved={() => {
            setDialog(null);
            void load();
          }}
        />
      )}

      {aiEnabled && showDraft && (
        <TrainingDraftDialog
          onClose={() => setShowDraft(false)}
          onSaved={(businessId) => {
            setShowDraft(false);
            notify(p.savedDraft(businessId));
            void load();
          }}
          onOpenInBuilder={(initial) => {
            setShowDraft(false);
            setDialog({ mode: 'new', initial });
          }}
        />
      )}

      {showImport && firebaseUser && (
        <BulkImportDialog
          title={p.importTitle}
          hint={p.importHint}
          formatIssue={(issue: TrainingImportIssue) => trainingImportIssueText(issue, t)}
          exampleJson={TRAINING_IMPORT_EXAMPLE}
          validate={async (rows) => {
            const names = collectExerciseNames(rows);
            if (names.length > MAX_IMPORT_EXERCISE_NAMES) {
              return {
                inputs: [],
                errors: [{ code: 'tooManyNames' as const, max: MAX_IMPORT_EXERCISE_NAMES }],
              };
            }
            const map = await resolveExerciseNames(names);
            return validateTrainingRows(rows, map);
          }}
          commit={(inputs) => bulkCreateTrainings(inputs, firebaseUser.uid)}
          onClose={() => setShowImport(false)}
          onImported={(n) => {
            setShowImport(false);
            notify(p.imported(n));
            void load();
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={p.deleteTitle(pendingDelete.businessId)}
          message={p.deleteMessage}
          confirmLabel={p.deleteConfirm}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
          error={deleteError}
        />
      )}
    </div>
  );
}
