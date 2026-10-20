import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { getPhysicalTest } from '../players/physicalTestsApi';
import { formatPhysicalTestSummary } from '../players/physicalTestFormat';
import { getPlayer } from '../players/playersApi';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER, type PhysicalTestType } from '../types/physicalTest';
import type { TestingSession } from '../types/testingSession';
import { listSessionEntries } from './testingSessionsApi';

interface PlayerResults {
  playerId: string;
  name: string;
  results: { testType: PhysicalTestType; value: string }[];
}

/** Read-only results of a closed session: who was tested, and each result recorded that day. */
export function PastSessionDialog({ teamId, session, onClose }: { teamId: string; session: TestingSession; onClose: () => void }) {
  const [rows, setRows] = useState<PlayerResults[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await listSessionEntries(teamId, session.id);
      const playerIds = [...new Set(entries.map((e) => e.playerId))];
      // Bounded: one read per tested player and per finished result (≤ players × 8).
      const loaded = await Promise.all(
        playerIds.map(async (playerId): Promise<PlayerResults> => {
          const mine = entries
            .filter((e) => e.playerId === playerId)
            .sort((a, b) => PHYSICAL_TEST_ORDER.indexOf(a.testType) - PHYSICAL_TEST_ORDER.indexOf(b.testType));
          const [player, results] = await Promise.all([
            getPlayer(teamId, playerId),
            Promise.all(
              mine.map(async (e) => {
                if (e.status !== 'complete' || !e.resultTestId) return { testType: e.testType, value: 'Not finished' };
                const test = await getPhysicalTest(teamId, playerId, e.resultTestId);
                return { testType: e.testType, value: test ? formatPhysicalTestSummary(test) : 'Result deleted' };
              }),
            ),
          ]);
          return { playerId, name: player?.fullName ?? 'Removed player', results };
        }),
      );
      if (!cancelled) setRows(loaded.sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(() => {
      if (!cancelled) setError('Could not load this session. Please try again.');
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, session.id]);

  return (
    <Dialog title={`Physical testing · ${session.date}`} size="lg" mobileSheet onClose={onClose}>
      {error && (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      )}
      {!rows && !error && <p className="text-sm text-slate">Loading results…</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate">No results were recorded in this session.</p>}
      {rows && rows.length > 0 && (
        <>
          <p className="mb-3 text-sm tabular-nums text-slate">
            {rows.length} player{rows.length === 1 ? '' : 's'} tested
          </p>
          <ul aria-label="Results" className="divide-y divide-border rounded-md border border-border">
            {rows.map((r) => (
              <li key={r.playerId} className="p-3">
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                  {r.results.map((x) => (
                    <div key={x.testType} className="contents">
                      <dt className="text-slate">{PHYSICAL_TEST_LABELS[x.testType]}</dt>
                      <dd className={`tabular-nums ${x.value === 'Not finished' ? 'text-orange-strong' : 'text-ink'}`}>{x.value}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
