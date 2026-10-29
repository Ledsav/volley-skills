import { usePageMeta } from '../layout/usePageMeta';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { BulkImportDialog } from '../bulkImport/BulkImportDialog';
import { Button } from '../components/Button';
import { SkeletonBlock } from '../components/Skeleton';
import { Input } from '../components/Input';
import { useDebouncedValue } from '../components/useDebouncedValue';
import { Plus, Sparkles } from 'lucide-react';
import { useTakePendingAction } from '../search/pendingAction';
import type { MenuItem } from '../components/Menu';
import { TrainingDraftDialog } from '../aiDraft/TrainingDraftDialog';
import type { NewTrainingInput, Training } from '../types/training';
import {
  bulkCreateTrainings,
  deleteTraining,
  findTrainingByBusinessId,
  getTraining,
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
import { useNotify, useUndoable } from '../components/Notice';
import { TrainingRow } from './TrainingRow';
import { PageHeader } from '../layout/PageHeader';
import { useT } from '../i18n/I18nProvider';
import { trainingImportIssueText } from './trainingsImportMessages';

type TeamContext = { teamId: string; date: string; notes: string };

export function TrainingsPage() {
  const t = useT();
  const p = t.trainings.page;
  usePageMeta({ title: p.title });
  const [searchParams, setSearchParams] = useSearchParams();
  const { firebaseUser } = useAuth();
  const { aiEnabled } = useClubFeatures();
  const [showImport, setShowImport] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const notify = useNotify();
  const undoable = useUndoable();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useTakePendingAction('new-training', () => setDialog({ mode: 'new' }));
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
    | { mode: 'view'; training: Training; teamContext?: TeamContext; autoPdf?: boolean }
    | { mode: 'edit'; training: Training; fromView: boolean; teamContext?: TeamContext }
    | null
  >(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
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

  // Opened from a search result (?training=<id>): load it once, open its plan, drop the param.
  const trainingParam = searchParams.get('training');
  useEffect(() => {
    if (!trainingParam) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('training');
        return next;
      },
      { replace: true },
    );
    getTraining(trainingParam)
      .then((found) => {
        if (found) setDialog({ mode: 'view', training: found });
      })
      .catch(() => {});
  }, [trainingParam, setSearchParams]);

  function setHiddenId(id: string, value: boolean) {
    setHidden((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // The row leaves at once; the delete runs when the Undo notice expires (and the row is dropped, no reload).
  function requestDelete(training: Training) {
    setDeleteError(null);
    setHiddenId(training.id, true);
    undoable({
      message: p.deletedNotice(training.businessId),
      commit: async () => {
        await deleteTraining(training.id);
        if (mounted.current) {
          setTrainings((current) => current.filter((x) => x.id !== training.id));
          setHiddenId(training.id, false);
        }
      },
      onUndo: () => {
        if (mounted.current) setHiddenId(training.id, false);
      },
      onCommitError: () => {
        if (mounted.current) {
          setHiddenId(training.id, false);
          setDeleteError(p.deleteError);
        }
      },
    });
  }

  const visible = trainings.filter((x) => !hidden.has(x.id));

  const moreItems: MenuItem[] = [
    { kind: 'action', label: p.import, onSelect: () => setShowImport(true) },
    ...(aiEnabled ? [{ kind: 'action' as const, label: p.draftWithAi, icon: <Sparkles size={16} aria-hidden="true" />, onSelect: () => setShowDraft(true) }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={p.title}
        mainAction={{ label: p.newTraining, icon: Plus, onSelect: () => setDialog({ mode: 'new' }) }}
        more={moreItems}
        className="mb-4"
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-full sm:w-auto">
          <label htmlFor="filter-age" className="mb-1 block text-footnote text-ink-2">
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
          <label htmlFor="filter-bid" className="mb-1 block text-footnote text-ink-2">
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
        <p role="alert" className="mb-4 text-red-strong">
          {error}
        </p>
      )}
      {deleteError && (
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

      {loaded && visible.length === 0 && <p className="rounded-lg bg-surface p-4 text-ink-2 shadow-card">{p.none}</p>}
      {visible.length > 0 && (
        <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
          {visible.map((training) => (
            <TrainingRow
              key={training.id}
              training={training}
              onOpen={() => setDialog({ mode: 'view', training })}
              onEdit={() => setDialog({ mode: 'edit', training, fromView: false })}
              onExportPdf={() => setDialog({ mode: 'view', training, autoPdf: true })}
              onDelete={() => requestDelete(training)}
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

      {dialog?.mode === 'view' && (
        <TrainingViewSheet
          training={dialog.training}
          onClose={() => setDialog(null)}
          teamContext={dialog.teamContext}
          autoBuildPdf={dialog.autoPdf}
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
    </div>
  );
}
