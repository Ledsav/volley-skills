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
import { FilterChips } from '../components/Chip';
import { normalize } from '../search/searchTokens';
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
import { PageContainer } from '../layout/PageContainer';
import { asBusinessId } from './businessId';

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
  // The age groups seen in the library so far: the chips offered above the list.
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const [search, setSearch] = useState(() => searchParams.get('businessId') ?? '');
  // Opened from a team's calendar session (?team=…&session=…): open that training with its team context, once.
  const sessionLink = useRef({ teamId: searchParams.get('team'), sessionId: searchParams.get('session'), opened: false });
  // A search that reads as a business ID is one exact lookup, debounced so it fires once the user stops typing;
  // any other text filters the loaded list by name as you type.
  const debouncedSearch = useDebouncedValue(search, 350);
  const idQuery = asBusinessId(debouncedSearch);
  const nameNeedle = asBusinessId(search) ? '' : normalize(search.trim());
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

  function rememberAgeGroups(list: Training[]) {
    setAgeGroups((current) => {
      const next = new Set(current);
      for (const x of list) if (x.ageGroupTarget.trim()) next.add(x.ageGroupTarget.trim());
      return next.size === current.length ? current : [...next].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    });
  }

  async function load() {
    if (idQuery) {
      const found = await findTrainingByBusinessId(idQuery);
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
    const page = await listTrainings(null, ageGroup ? { ageGroupTarget: ageGroup } : {});
    rememberAgeGroups(page.trainings);
    setTrainings(page.trainings);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
    setLoaded(true);
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listTrainings(lastDoc, ageGroup ? { ageGroupTarget: ageGroup } : {});
    rememberAgeGroups(page.trainings);
    setTrainings((current) => [...current, ...page.trainings]);
    setLastDoc(page.lastDoc);
    setHasMore(page.hasMore);
  }

  useEffect(() => {
    setError(null);
    setLoaded(false);
    load().catch(() => setError(p.loadError));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, idQuery]);

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

  const visible = trainings.filter(
    (x) => !hidden.has(x.id) && (!nameNeedle || normalize(`${x.name} ${x.businessId}`).includes(nameNeedle)),
  );

  const moreItems: MenuItem[] = [
    { kind: 'action', label: p.import, onSelect: () => setShowImport(true) },
    ...(aiEnabled ? [{ kind: 'action' as const, label: p.draftWithAi, icon: <Sparkles size={16} aria-hidden="true" />, onSelect: () => setShowDraft(true) }] : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        title={p.title}
        mainAction={{ label: p.newTraining, icon: Plus, onSelect: () => setDialog({ mode: 'new' }) }}
        more={moreItems}
        className="mb-4"
      />

      <div className="mb-4 flex flex-col gap-3">
        <Input
          type="search"
          aria-label={p.search}
          placeholder={p.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-sm"
        />
        {ageGroups.length > 0 && !idQuery && (
          <FilterChips
            label={p.ageGroup}
            options={[{ id: '', label: p.allAgeGroups }, ...ageGroups.map((g) => ({ id: g, label: g }))]}
            value={ageGroup}
            onChange={setAgeGroup}
          />
        )}
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
    </PageContainer>
  );
}
