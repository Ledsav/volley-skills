import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { getLatestByType } from './physicalTestsApi';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import { PhysicalTestHistoryList } from './PhysicalTestHistoryList';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

interface PhysicalTestingSectionProps {
  teamId: string;
  playerId: string;
  isAdmin: boolean;
}

export function PhysicalTestingSection({ teamId, playerId, isAdmin }: PhysicalTestingSectionProps) {
  const { firebaseUser } = useAuth();
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [activeDialogType, setActiveDialogType] = useState<PhysicalTestType | null>(null);
  const [historyType, setHistoryType] = useState<PhysicalTestType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    const entries = await Promise.all(PHYSICAL_TEST_ORDER.map((t) => getLatestByType(teamId, playerId, t)));
    const next: Partial<Record<PhysicalTestType, PhysicalTest | null>> = {};
    PHYSICAL_TEST_ORDER.forEach((t, i) => {
      next[t] = entries[i];
    });
    setLatestByType(next);
  }

  useEffect(() => {
    setLoadError(null);
    loadAll().catch(() => setLoadError('Could not load physical testing data. Please refresh the page.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId]);

  return (
    <section className="p-6">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Physical Testing</h2>
      {loadError && (
        <p role="alert" className="mt-3 text-red">
          {loadError}
        </p>
      )}
      {!loadError && (
        <ul className="mt-3 divide-y divide-border">
          {PHYSICAL_TEST_ORDER.map((testType) => {
            const latest = latestByType[testType];
            return (
              <li key={testType} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-ink">{PHYSICAL_TEST_LABELS[testType]}</p>
                  <p className="text-sm text-slate">{latest ? `${formatPhysicalTestSummary(latest)} — ${latest.date}` : 'No data yet'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setHistoryType(testType)}>
                    View history
                  </Button>
                  {isAdmin && (
                    <Button variant="secondary" size="sm" onClick={() => setActiveDialogType(testType)}>
                      Add new
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
          onClose={() => setActiveDialogType(null)}
          onSaved={() => {
            setActiveDialogType(null);
            setLoadError(null);
            loadAll().catch(() => setLoadError('Could not load physical testing data. Please refresh the page.'));
          }}
        />
      )}
      {historyType && (
        <PhysicalTestHistoryList teamId={teamId} playerId={playerId} testType={historyType} onClose={() => setHistoryType(null)} />
      )}
    </section>
  );
}
