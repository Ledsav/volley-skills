import { useEffect, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { getPhysicalTest } from '../players/physicalTestsApi';
import { formatPhysicalTestSummary } from '../players/physicalTestFormat';
import { getPlayer } from '../players/playersApi';
import { PHYSICAL_TEST_ORDER, type PhysicalTestType } from '../types/physicalTest';
import type { TestingSession } from '../types/testingSession';
import { deleteSession, listSessionEntries } from './testingSessionsApi';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n/I18nProvider';

interface PlayerResults {
  playerId: string;
  name: string;
  results: { testType: PhysicalTestType; kind: 'value' | 'notFinished' | 'deleted'; value: string }[];
}

/** Read-only results of a closed session: who was tested, and each result recorded that day. */
export function PastSessionDialog({
  teamId,
  session,
  onClose,
  onDeleted,
}: {
  teamId: string;
  session: TestingSession;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const s = t.physicalSessions;
  const [rows, setRows] = useState<PlayerResults[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function confirmDelete() {
    try {
      await deleteSession(teamId, session.id);
    } catch {
      setDeleteError(t.common.couldNotDeleteSession);
      return;
    }
    setConfirmingDelete(false);
    onDeleted();
  }

  const resultCount = (rows ?? []).reduce(
    (n, r) => n + r.results.filter((x) => x.kind === 'value').length,
    0,
  );

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
                if (e.status !== 'complete' || !e.resultTestId) return { testType: e.testType, kind: 'notFinished' as const, value: '' };
                const test = await getPhysicalTest(teamId, playerId, e.resultTestId);
                return test
                  ? { testType: e.testType, kind: 'value' as const, value: formatPhysicalTestSummary(test) }
                  : { testType: e.testType, kind: 'deleted' as const, value: '' };
              }),
            ),
          ]);
          return { playerId, name: player?.fullName ?? s.past.removedPlayer, results };
        }),
      );
      if (!cancelled) setRows(loaded.sort((a, b) => a.name.localeCompare(b.name)));
    })().catch(() => {
      if (!cancelled) setError(s.past.loadError);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, session.id, s.past.loadError, s.past.removedPlayer]);

  return (
    <Dialog
      title={s.past.title(session.date)}
      size="lg"
      mobileSheet
      onClose={onClose}
      footer={
        <Button variant="dangerGhost" onClick={() => { setDeleteError(null); setConfirmingDelete(true); }} disabled={!rows && !error}>
          {s.shared.deleteSession}
        </Button>
      }
    >
      {error && (
        <p role="alert" className="text-sm text-red-strong">
          {error}
        </p>
      )}
      {!rows && !error && <p className="text-sm text-slate">{s.past.loading}</p>}
      {rows && rows.length === 0 && <p className="text-sm text-slate">{s.past.empty}</p>}
      {rows && rows.length > 0 && (
        <>
          <p className="mb-3 text-sm tabular-nums text-slate">
            {s.past.playersTested(rows.length)}
          </p>
          <ul aria-label={s.past.resultsAria} className="divide-y divide-border rounded-md border border-border">
            {rows.map((r) => (
              <li key={r.playerId} className="p-3">
                <p className="text-sm font-medium text-ink">{r.name}</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
                  {r.results.map((x) => (
                    <div key={x.testType} className="contents">
                      <dt className="text-slate">{t.labels.physicalTest[x.testType]}</dt>
                      <dd className={`tabular-nums ${x.kind === 'notFinished' ? 'text-orange-strong' : 'text-ink'}`}>
                        {x.kind === 'value' ? x.value : x.kind === 'notFinished' ? s.past.notFinished : s.past.resultDeleted}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={s.shared.deleteTitle}
          message={s.shared.deleteMessage(resultCount)}
          confirmLabel={s.shared.deleteConfirm}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmingDelete(false)}
          error={deleteError}
        />
      )}
    </Dialog>
  );
}
