import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { TrendSeries } from './physicalTestChart';
import { buildTrendSeries } from './physicalTestChart';
import { formatPhysicalTestDetail, formatPhysicalTestSummary } from './physicalTestFormat';
import { deletePhysicalTest, listHistoryByType, listSeriesByType } from './physicalTestsApi';
import { PhysicalTestTrendChart } from './PhysicalTestTrendChart';

interface PhysicalTestHistoryListProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  isAdmin: boolean;
  onClose: () => void;
}

export function PhysicalTestHistoryList({ teamId, playerId, testType, isAdmin, onClose }: PhysicalTestHistoryListProps) {
  const [tests, setTests] = useState<PhysicalTest[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [series, setSeries] = useState<TrendSeries | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDelete(testId: string) {
    setDeleteError(null);
    try {
      await deletePhysicalTest(teamId, playerId, testId);
      setPendingDeleteId(null);
      setExpandedId(null);
      await Promise.all([loadFirstPage(), loadSeries()]);
    } catch {
      setDeleteError('Could not delete this entry. Please try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">{PHYSICAL_TEST_LABELS[testType]} history</h2>
        {series && <PhysicalTestTrendChart series={series} />}
        {loaded && tests.length === 0 && <p className="text-slate">No entries yet.</p>}
        <ul className="divide-y divide-border">
          {tests.map((test) => {
            const isExpanded = expandedId === test.id;
            return (
              <li key={test.id} className="py-2 text-sm text-ink">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : test.id)}
                  className="flex w-full items-center gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="shrink-0 text-slate" />
                  ) : (
                    <ChevronRight size={16} className="shrink-0 text-slate" />
                  )}
                  <span>
                    {test.date} — {formatPhysicalTestSummary(test)}
                  </span>
                </button>
                {isExpanded && (
                  <div className="ml-6 mt-2 rounded-md bg-bg p-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      {formatPhysicalTestDetail(test).map((row) => (
                        <div key={row.label} className="contents">
                          <dt className="text-slate">{row.label}</dt>
                          <dd className="tabular-nums text-ink">{row.value}</dd>
                        </div>
                      ))}
                      {test.notes && (
                        <div className="contents">
                          <dt className="text-slate">Notes</dt>
                          <dd className="text-ink">{test.notes}</dd>
                        </div>
                      )}
                    </dl>
                    {isAdmin && (
                      <Button
                        variant="dangerGhost"
                        size="sm"
                        onClick={() => setPendingDeleteId(test.id)}
                        className="mt-2"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete entry
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {hasMore && (
          <Button variant="secondary" size="sm" onClick={() => void loadMore()} className="mt-3">
            Load more
          </Button>
        )}
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      {pendingDeleteId && (
        <ConfirmDialog
          title="Delete this entry?"
          message="This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => void handleDelete(pendingDeleteId)}
          onCancel={() => {
            setPendingDeleteId(null);
            setDeleteError(null);
          }}
          error={deleteError}
        />
      )}
    </div>
  );
}
