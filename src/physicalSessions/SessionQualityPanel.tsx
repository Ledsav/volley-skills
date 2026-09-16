import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { Stopwatch } from './Stopwatch';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from '../players/physicalTestFieldLogic';
import { getLatestByType } from '../players/physicalTestsApi';
import { saveEntryProgress, finishEntry } from './testingSessionsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { BodyweightExercise, PhysicalTestType, WeightedExercise } from '../types/physicalTest';
import type { TestingSessionEntry } from '../types/testingSession';

const DEFAULT_FIELDS: PhysicalTestFields = {
  heightCm: '',
  bodyMassKg: '',
  cmjAttempts: [],
  broadJumpAttempts: [],
  standingReachCm: '',
  touchAttempts: [],
  sprintAttempts: [],
  rightFirstSeconds: '',
  leftFirstSeconds: '',
  reactionAttempts: [],
  strengthMode: 'weighted',
  weightedExercise: 'trapBarDeadlift',
  weightKg: '',
  bodyweightExercise: 'pushUps',
  reps: '',
};

interface SessionQualityPanelProps {
  teamId: string;
  sessionId: string;
  sessionDate: string;
  playerId: string;
  testType: PhysicalTestType;
  entry: TestingSessionEntry | null;
  recordedByUid: string;
  onClose: () => void;
  onFinished: () => void;
}

const ATTEMPT_FIELD: Partial<Record<PhysicalTestType, { key: keyof PhysicalTestFields; label: string; unit: string }>> = {
  cmj: { key: 'cmjAttempts', label: 'New attempt (cm)', unit: 'cm' },
  broadJump: { key: 'broadJumpAttempts', label: 'New attempt (cm)', unit: 'cm' },
  approachJump: { key: 'touchAttempts', label: 'New touch attempt (cm)', unit: 'cm' },
  sprint10m: { key: 'sprintAttempts', label: 'New attempt (s)', unit: 's' },
  reaction: { key: 'reactionAttempts', label: 'New drop attempt (cm)', unit: 'cm' },
};

export function SessionQualityPanel({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  testType,
  entry,
  recordedByUid,
  onClose,
  onFinished,
}: SessionQualityPanelProps) {
  const [fields, setFields] = useState<PhysicalTestFields>({ ...DEFAULT_FIELDS, ...(entry?.data ?? {}) });
  const [notes, setNotes] = useState('');
  const [newAttempt, setNewAttempt] = useState('');
  const [latestBodyMassKg, setLatestBodyMassKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (testType !== 'strength') return;
    void getLatestByType(teamId, playerId, 'growth').then((latest) => {
      setLatestBodyMassKg(latest && latest.testType === 'growth' ? latest.bodyMassKg : null);
    });
  }, [teamId, playerId, testType]);

  function persist(next: PhysicalTestFields) {
    setFields(next);
    void saveEntryProgress(teamId, sessionId, playerId, testType, next as unknown as Record<string, unknown>);
  }

  const attemptConfig = ATTEMPT_FIELD[testType];

  function addAttempt() {
    if (!attemptConfig || newAttempt === '') return;
    const value = Number(newAttempt);
    if (Number.isNaN(value)) return;
    const nextArray = [...(fields[attemptConfig.key] as number[]), value];
    persist({ ...fields, [attemptConfig.key]: nextArray });
    setNewAttempt('');
  }

  function removeAttempt(index: number) {
    if (!attemptConfig) return;
    const nextArray = (fields[attemptConfig.key] as number[]).filter((_, i) => i !== index);
    persist({ ...fields, [attemptConfig.key]: nextArray });
  }

  async function handleFinish() {
    if (saving) return;
    setError(null);
    setSaving(true);
    const input = buildPhysicalTestInput(testType, fields, sessionDate, notes, latestBodyMassKg);
    try {
      await finishEntry(teamId, sessionId, playerId, testType, input, recordedByUid);
    } catch {
      setError('Could not confirm this was saved — check the player card before recording it again.');
      return;
    } finally {
      setSaving(false);
    }
    onFinished();
  }

  const ready = isPhysicalTestReady(testType, fields);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop [scrollbar-gutter:stable]">
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">{PHYSICAL_TEST_LABELS[testType]}</h2>

        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="height" className="mb-1 block text-sm font-medium text-ink">Height (cm)</label>
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                step="any"
                value={fields.heightCm}
                onChange={(e) => setFields({ ...fields, heightCm: e.target.value })}
                onBlur={() => persist(fields)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="body-mass" className="mb-1 block text-sm font-medium text-ink">Body mass (kg)</label>
              <Input
                id="body-mass"
                type="number"
                inputMode="decimal"
                step="any"
                value={fields.bodyMassKg}
                onChange={(e) => setFields({ ...fields, bodyMassKg: e.target.value })}
                onBlur={() => persist(fields)}
              />
            </div>
          </>
        )}

        {testType === 'approachJump' && (
          <div className="mb-4">
            <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">Standing reach (cm)</label>
            <Input
              id="standing-reach"
              type="number"
              inputMode="decimal"
              step="any"
              value={fields.standingReachCm}
              onChange={(e) => setFields({ ...fields, standingReachCm: e.target.value })}
              onBlur={() => persist(fields)}
            />
          </div>
        )}

        {testType === 'shuttle5105' && (
          <>
            <div className="mb-4">
              <label htmlFor="shuttle-right" className="mb-1 block text-sm font-medium text-ink">Right-first (s)</label>
              <div className="flex items-center gap-3">
                <Input
                  id="shuttle-right"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="w-24"
                  value={fields.rightFirstSeconds}
                  onChange={(e) => setFields({ ...fields, rightFirstSeconds: e.target.value })}
                  onBlur={() => persist(fields)}
                />
                <Stopwatch onRecord={(s) => persist({ ...fields, rightFirstSeconds: String(s) })} />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">Left-first (s)</label>
              <div className="flex items-center gap-3">
                <Input
                  id="shuttle-left"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  className="w-24"
                  value={fields.leftFirstSeconds}
                  onChange={(e) => setFields({ ...fields, leftFirstSeconds: e.target.value })}
                  onBlur={() => persist(fields)}
                />
                <Stopwatch onRecord={(s) => persist({ ...fields, leftFirstSeconds: String(s) })} />
              </div>
            </div>
          </>
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">Mode</label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={fields.strengthMode}
                onChange={(e) => persist({ ...fields, strengthMode: e.target.value as 'weighted' | 'bodyweight' })}
              >
                <option value="weighted">Weighted</option>
                <option value="bodyweight">Bodyweight</option>
              </select>
            </div>
            {fields.strengthMode === 'weighted' ? (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-exercise" className="mb-1 block text-sm font-medium text-ink">Exercise</label>
                  <select
                    id="strength-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={fields.weightedExercise}
                    onChange={(e) => persist({ ...fields, weightedExercise: e.target.value as WeightedExercise })}
                  >
                    <option value="trapBarDeadlift">Trap-bar deadlift</option>
                    <option value="squat">Squat</option>
                    <option value="gobletSquat">Goblet squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">Weight (kg)</label>
                  <Input
                    id="strength-weight"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={fields.weightKg}
                    onChange={(e) => setFields({ ...fields, weightKg: e.target.value })}
                    onBlur={() => persist(fields)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-bodyweight-exercise" className="mb-1 block text-sm font-medium text-ink">Exercise</label>
                  <select
                    id="strength-bodyweight-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={fields.bodyweightExercise}
                    onChange={(e) => persist({ ...fields, bodyweightExercise: e.target.value as BodyweightExercise })}
                  >
                    <option value="pushUps">Push-ups</option>
                    <option value="splitSquat">Split squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">Reps</label>
                  <Input
                    id="strength-reps"
                    type="number"
                    inputMode="numeric"
                    value={fields.reps}
                    onChange={(e) => setFields({ ...fields, reps: e.target.value })}
                    onBlur={() => persist(fields)}
                  />
                </div>
              </>
            )}
          </>
        )}

        {attemptConfig && (
          <div className="mb-4">
            <ul className="mb-3 flex flex-wrap gap-2">
              {(fields[attemptConfig.key] as number[]).map((value, index) => (
                <li key={index} className="flex items-center gap-1 rounded-full bg-blue/10 py-1 pl-3 pr-1 text-sm text-ink">
                  {value} {attemptConfig.unit}
                  <button
                    type="button"
                    aria-label={`Remove attempt ${index + 1}`}
                    onClick={() => removeAttempt(index)}
                    className="rounded-full p-1 text-red hover:bg-red/10"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <label htmlFor="new-attempt" className="sr-only">{attemptConfig.label}</label>
              <Input
                id="new-attempt"
                aria-label={attemptConfig.label}
                type="number"
                inputMode="decimal"
                step="any"
                className="w-28"
                value={newAttempt}
                onChange={(e) => setNewAttempt(e.target.value)}
              />
              <Button variant="secondary" size="md" onClick={addAttempt}>
                + Add attempt
              </Button>
              {(testType === 'sprint10m') && (
                <Stopwatch onRecord={(s) => { setNewAttempt(String(s)); }} />
              )}
            </div>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-ink">Notes</label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => persist(fields)} />
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => void handleFinish()} disabled={!ready || saving}>
            Finish
          </Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red">{error}</p>}
      </div>
    </div>
  );
}
