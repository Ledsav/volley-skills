import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useClubFeatures } from '../clubs/useClubFeatures';
import { Button } from '../components/Button';
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
            return (
              <li key={testType} className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-headline text-ink">
                    {t.labels.physicalTest[testType]}
                    <PendingDot pending={sync.isPending(`test:${testType}`)} />
                  </p>
                  <p className="text-footnote tabular-nums text-ink-2">
                    {latest ? `${formatPhysicalTestSummary(latest)} — ${latest.date}` : p.noData}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                      setDeleteError(null);
                      setHistoryType(testType);
                    }}>
                    {p.viewHistory}
                  </Button>
                  {canAdd && (
                    <Button variant="secondary" size="sm" onClick={() => setActiveDialogType(testType)}>
                      {p.addNew}
                    </Button>
                  )}
                </div>
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
