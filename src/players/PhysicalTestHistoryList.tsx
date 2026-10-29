import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { useContextMenu } from '../components/ContextMenu';
import { useUndoable } from '../components/Notice';
import { Sheet } from '../components/Sheet';
import { SkeletonBlock } from '../components/Skeleton';
import { SwipeRow } from '../components/SwipeRow';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import type { TrendSeries } from './physicalTestChart';
import { buildTrendSeries } from './physicalTestChart';
import { formatPhysicalTestDetail, formatPhysicalTestSummary } from './physicalTestFormat';
import { deletePhysicalTest, listHistoryByType, listSeriesByType } from './physicalTestsApi';
import { PhysicalTestTrendChart } from './PhysicalTestTrendChart';
import { useT } from '../i18n/I18nProvider';

interface PhysicalTestHistoryListProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  isAdmin: boolean;
  onClose: () => void;
  /** Called after an entry is deleted, so the latest-per-type summary can refresh. */
  onDeleted?: () => void;
  /** Called when a delete fails after this list has unmounted (the sheet was closed during the undo window). */
  onDeleteFailed?: () => void;
}

interface HistoryRowProps {
  test: PhysicalTest;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function HistoryRow({ test, isAdmin, expanded, onToggle, onDelete }: HistoryRowProps) {
  const t = useT();
  const h = t.players.physical.history;
  const { targetProps, menu } = useContextMenu({
    label: h.rowMenu(test.date),
    items: [{ kind: 'action', label: h.deleteEntry, danger: true, icon: <Trash2 size={16} />, onSelect: onDelete }],
    disabled: !isAdmin,
  });
  return (
    <li {...targetProps} className="text-callout text-ink">
      <SwipeRow
        disabled={!isAdmin}
        trailing={[{ label: t.common.delete, icon: <Trash2 size={18} />, tone: 'destructive', undoable: true, onAction: onDelete }]}
      >
        <div className="bg-surface-2">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-h-11 w-full items-center gap-2 px-4 text-left tabular-nums"
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown size={16} className="shrink-0 text-ink-3" />
            ) : (
              <ChevronRight size={16} className="shrink-0 text-ink-3" />
            )}
            <span>
              {test.date} — {formatPhysicalTestSummary(test)}
            </span>
          </button>
          {expanded && (
            <div className="px-4 pb-3 pl-10">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-callout">
                {formatPhysicalTestDetail(test).map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-ink-2">{row.label}</dt>
                    <dd className="tabular-nums text-ink">{row.value}</dd>
                  </div>
                ))}
                {test.notes && (
                  <div className="contents">
                    <dt className="text-ink-2">{h.notes}</dt>
                    <dd className="text-ink">{test.notes}</dd>
                  </div>
                )}
              </dl>
              {isAdmin && (
                <Button variant="dangerGhost" size="sm" onClick={onDelete} className="mt-2">
                  <Trash2 size={14} className="mr-1" />
                  {h.deleteEntry}
                </Button>
              )}
            </div>
          )}
        </div>
      </SwipeRow>
      {menu}
    </li>
  );
}

export function PhysicalTestHistoryList({ teamId, playerId, testType, isAdmin, onClose, onDeleted, onDeleteFailed }: PhysicalTestHistoryListProps) {
  const t = useT();
  const h = t.players.physical.history;
  const undoable = useUndoable();
  const mounted = useRef(true);
  const [tests, setTests] = useState<PhysicalTest[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [series, setSeries] = useState<TrendSeries | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadFirstPage() {
    const page = await listHistoryByType(teamId, playerId, testType);
    setTests(page.tests);
    setLastDoc(page.lastDoc);
    setHasMore(page.tests.length > 0 && page.lastDoc !== null);
    setLoaded(true);
  }

  async function loadSeries() {
    const seriesTests = await listSeriesByType(teamId, playerId, testType);
    setSeries(buildTrendSeries(testType, seriesTests));
  }

  async function loadMore() {
    if (!lastDoc) return;
    const page = await listHistoryByType(teamId, playerId, testType, lastDoc);
    setTests((current) => [...current, ...page.tests]);
    setLastDoc(page.lastDoc);
    setHasMore(page.tests.length > 0 && page.lastDoc !== null);
  }

  useEffect(() => {
    void loadFirstPage();
    void loadSeries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId, testType]);

  function setHiddenId(id: string, on: boolean) {
    setHidden((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function requestDelete(test: PhysicalTest) {
    setHiddenId(test.id, true);
    setExpandedId((current) => (current === test.id ? null : current));
    setDeleteError(null);
    undoable({
      message: h.deletedNotice(test.date),
      commit: async () => {
        await deletePhysicalTest(teamId, playerId, test.id);
        // The entry is gone; a failed refresh must not be reported as a failed delete.
        try {
          onDeleted?.();
          if (mounted.current) await Promise.all([loadFirstPage(), loadSeries()]);
        } catch {
          /* the next open reloads */
        }
      },
      onUndo: () => {
        if (mounted.current) setHiddenId(test.id, false);
      },
      onCommitError: () => {
        if (mounted.current) {
          setHiddenId(test.id, false);
          setDeleteError(h.deleteError);
        } else {
          onDeleteFailed?.();
        }
      },
    });
  }

  const shown = tests.filter((test) => !hidden.has(test.id));

  return (
    <Sheet title={h.title(t.labels.physicalTest[testType])} onClose={onClose} size="lg" detent="large">
      {deleteError && (
        <p role="alert" className="mb-3 text-callout text-red-strong">
          {deleteError}
        </p>
      )}
      {series && <PhysicalTestTrendChart series={series} />}
      {!loaded && (
        <div className="mt-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <SkeletonBlock key={i} className="h-11" />
          ))}
        </div>
      )}
      {loaded && shown.length === 0 && <p className="text-ink-2">{h.none}</p>}
      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-separator overflow-hidden rounded-lg bg-surface-2">
          {shown.map((test) => (
            <HistoryRow
              key={test.id}
              test={test}
              isAdmin={isAdmin}
              expanded={expandedId === test.id}
              onToggle={() => setExpandedId(expandedId === test.id ? null : test.id)}
              onDelete={() => requestDelete(test)}
            />
          ))}
        </ul>
      )}
      {hasMore && (
        <Button variant="secondary" size="sm" onClick={() => void loadMore()} className="mt-3">
          {t.players.shared.loadMore}
        </Button>
      )}
    </Sheet>
  );
}
