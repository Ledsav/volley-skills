import { useEffect, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { Button } from '../components/Button';
import { listHistoryByType } from './physicalTestsApi';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

interface PhysicalTestHistoryListProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  onClose: () => void;
}

export function PhysicalTestHistoryList({ teamId, playerId, testType, onClose }: PhysicalTestHistoryListProps) {
  const [tests, setTests] = useState<PhysicalTest[]>([]);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadFirstPage() {
    const page = await listHistoryByType(teamId, playerId, testType);
    setTests(page.tests);
    setLastDoc(page.lastDoc);
    setHasMore(page.tests.length > 0 && page.lastDoc !== null);
    setLoaded(true);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId, testType]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">{PHYSICAL_TEST_LABELS[testType]} history</h2>
        {loaded && tests.length === 0 && <p className="text-slate">No entries yet.</p>}
        <ul className="divide-y divide-border">
          {tests.map((test) => (
            <li key={test.id} className="py-2 text-sm text-ink">
              {test.date} — {formatPhysicalTestSummary(test)}
            </li>
          ))}
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
    </div>
  );
}
