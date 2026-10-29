import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { ChevronRight, Plus } from 'lucide-react';
import { formatDate } from '../i18n/format';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';
import { PHYSICAL_TEST_ORDER, visibleTestTypes } from '../types/physicalTest';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';
import { fetchLatestTests, loadLatestTests } from './physicalTestsApi';
import type { LatestTests } from '../types/player';
import { useT } from '../i18n/I18nProvider';
import { PendingDot, usePlayerSync } from './playerSync';

interface PhysicalTestingSectionProps {
  teamId: string;
  playerId: string;
  isAdmin: boolean;
  /** `player.latestTests` from the already-loaded player doc. */
  storedLatest?: LatestTests;
  /** Identity for the add-test sheet. */
  player?: { fullName: string; number: number };
  /** Notified after each successful load so a parent dashboard can derive summary stats. */
  onLatestLoaded?: (latestByType: Partial<Record<PhysicalTestType, PhysicalTest | null>>) => void;
}

export function PhysicalTestingSection({ teamId, playerId, isAdmin, storedLatest, onLatestLoaded, player }: PhysicalTestingSectionProps) {
  const t = useT();
  const p = t.players.physical;
  const { firebaseUser } = useAuth();
  const sync = usePlayerSync();
  const { growthTestsEnabled } = useClubFeatures();
  const visible = visibleTestTypes(growthTestsEnabled);
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [activeDialogType, setActiveDialogType] = useState<PhysicalTestType | null>(null);
  const [historyType, setHistoryType] = useState<PhysicalTestType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function apply(next: LatestTests) {
    setLatestByType(next);
    onLatestLoaded?.(next);
  }

  function reload() {
    setLoadError(null);
    fetchLatestTests(teamId, playerId, isAdmin)
      .then(apply)
      .catch(() => setLoadError(p.loadError));
  }

  useEffect(() => {
    setLoadError(null);
    loadLatestTests(teamId, playerId, storedLatest, isAdmin)
      .then(apply)
      .catch(() => setLoadError(p.loadError));
    // Only on player change: later updates come from reload(), not the stale prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId]);

  return (
    <div className="flex h-full flex-col">
      {loadError && (
        <p role="alert" className="text-callout text-red-strong">
          {loadError}
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-callout text-red-strong">
          {deleteError}
        </p>
      )}
      {!loadError && (
        <ul className="divide-y divide-separator">
          {PHYSICAL_TEST_ORDER.filter((type) => visible.includes(type) || !!latestByType[type]).map((testType) => {
            const latest = latestByType[testType];
            const canAdd = isAdmin && visible.includes(testType);
            const label = t.labels.physicalTest[testType];
            const body = (
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 text-headline text-ink">
                  {label}
                  <PendingDot pending={sync.isPending(`test:${testType}`)} />
                </span>
                <span className="text-footnote tabular-nums text-ink-2">
                  {latest ? `${formatPhysicalTestSummary(latest)} · ${formatDate(latest.date, 'short')}` : p.noData}
                </span>
              </span>
            );
            return (
              // One row per quality: the row opens its history (only when there is some), "+" adds an entry.
              <li key={testType} className="flex min-h-[52px] items-center gap-2">
                {latest ? (
                  <button
                    type="button"
                    aria-label={p.historyAria(label)}
                    onClick={() => {
                      setDeleteError(null);
                      setHistoryType(testType);
                    }}
                    className="-mx-2 flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus active:bg-surface-3"
                  >
                    {body}
                    <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ink-3" />
                  </button>
                ) : (
                  <div className="flex min-w-0 flex-1 items-center py-2">{body}</div>
                )}
                {canAdd && (
                  <button
                    type="button"
                    aria-label={p.addAria(label)}
                    title={p.addAria(label)}
                    onClick={() => setActiveDialogType(testType)}
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-2 text-ink hover:bg-surface-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  >
                    <Plus size={18} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {activeDialogType && firebaseUser && (
        <AddPhysicalTestDialog
          teamId={teamId}
          playerId={playerId}
          testType={activeDialogType}
          recordedByUid={firebaseUser.uid}
          player={player}
          latest={latestByType[activeDialogType]}
          onClose={() => setActiveDialogType(null)}
          onSaved={() => {
            setActiveDialogType(null);
            reload();
          }}
        />
      )}
      {historyType && (
        <PhysicalTestHistoryList
          teamId={teamId}
          playerId={playerId}
          testType={historyType}
          isAdmin={isAdmin}
          onClose={() => setHistoryType(null)}
          onDeleted={reload}
          onDeleteFailed={() => setDeleteError(p.history.deleteError)}
        />
      )}
    </div>
  );
}
