import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { getLatestByType } from './physicalTestsApi';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import { PHYSICAL_TEST_LABELS, PHYSICAL_TEST_ORDER } from '../types/physicalTest';
import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

function formatSummary(test: PhysicalTest): string {
  switch (test.testType) {
    case 'growth':
      return `${test.heightCm} cm, ${test.bodyMassKg} kg`;
    case 'cmj':
      return `${test.bestCm} cm`;
    case 'approachJump':
      return `${test.approachJumpCm} cm (touch ${test.bestTouchCm} cm)`;
    case 'broadJump':
      return `${test.bestCm} cm`;
    case 'sprint10m':
      return `${test.bestSeconds} s`;
    case 'shuttle5105':
      return `R ${test.rightFirstSeconds}s / L ${test.leftFirstSeconds}s`;
    case 'reaction':
      return `${test.reactionTimeMs.toFixed(0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${test.weightKg} kg (${test.bodyMassRatio !== null ? test.bodyMassRatio.toFixed(2) : '—'})`
        : `${test.reps} reps`;
  }
}

interface PhysicalTestingSectionProps {
  teamId: string;
  playerId: string;
  isAdmin: boolean;
}

export function PhysicalTestingSection({ teamId, playerId, isAdmin }: PhysicalTestingSectionProps) {
  const { firebaseUser } = useAuth();
  const [latestByType, setLatestByType] = useState<Partial<Record<PhysicalTestType, PhysicalTest | null>>>({});
  const [activeDialogType, setActiveDialogType] = useState<PhysicalTestType | null>(null);

  async function loadAll() {
    const entries = await Promise.all(PHYSICAL_TEST_ORDER.map((t) => getLatestByType(teamId, playerId, t)));
    const next: Partial<Record<PhysicalTestType, PhysicalTest | null>> = {};
    PHYSICAL_TEST_ORDER.forEach((t, i) => {
      next[t] = entries[i];
    });
    setLatestByType(next);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, playerId]);

  return (
    <section className="mt-6 rounded-lg border border-border bg-surface p-6 shadow-card">
      <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">Physical Testing</h2>
      <ul className="mt-3 divide-y divide-border">
        {PHYSICAL_TEST_ORDER.map((testType) => {
          const latest = latestByType[testType];
          return (
            <li key={testType} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-ink">{PHYSICAL_TEST_LABELS[testType]}</p>
                <p className="text-sm text-slate">{latest ? `${formatSummary(latest)} — ${latest.date}` : 'No data yet'}</p>
              </div>
              {isAdmin && (
                <Button variant="secondary" size="sm" onClick={() => setActiveDialogType(testType)}>
                  Add new
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {activeDialogType && firebaseUser && (
        <AddPhysicalTestDialog
          teamId={teamId}
          playerId={playerId}
          testType={activeDialogType}
          recordedByUid={firebaseUser.uid}
          onClose={() => setActiveDialogType(null)}
          onSaved={() => {
            setActiveDialogType(null);
            void loadAll();
          }}
        />
      )}
    </section>
  );
}
