import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { HealthHint } from '../components/HealthHint';
import { Stopwatch } from './Stopwatch';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from '../players/physicalTestFieldLogic';
import { getLatestByType } from '../players/physicalTestsApi';
import { saveEntryProgress, finishEntry } from './testingSessionsApi';
import { useT } from '../i18n/I18nProvider';
import { formatDecimal } from '../i18n/format';
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
  playerName: string;
  testType: PhysicalTestType;
  entry: TestingSessionEntry | null;
  recordedByUid: string;
  onClose: () => void;
  onFinished: () => void;
}

type AttemptLabel = 'newAttemptCm' | 'newTouchAttemptCm' | 'newAttemptS' | 'newDropAttemptCm';

const ATTEMPT_FIELD: Partial<Record<PhysicalTestType, { key: keyof PhysicalTestFields; label: AttemptLabel; unit: string }>> = {
  cmj: { key: 'cmjAttempts', label: 'newAttemptCm', unit: 'cm' },
  broadJump: { key: 'broadJumpAttempts', label: 'newAttemptCm', unit: 'cm' },
  approachJump: { key: 'touchAttempts', label: 'newTouchAttemptCm', unit: 'cm' },
  sprint10m: { key: 'sprintAttempts', label: 'newAttemptS', unit: 's' },
  reaction: { key: 'reactionAttempts', label: 'newDropAttemptCm', unit: 'cm' },
};

export function SessionQualityPanel({
  teamId,
  sessionId,
  sessionDate,
  playerId,
  playerName,
  testType,
  entry,
  recordedByUid,
  onClose,
  onFinished,
}: SessionQualityPanelProps) {
  const t = useT();
  const s = t.physicalSessions.panel;
  const [fields, setFields] = useState<PhysicalTestFields>({ ...DEFAULT_FIELDS, ...(entry?.data ?? {}) });
  const [notes, setNotes] = useState('');
  const [newAttempt, setNewAttempt] = useState('');
  const [latestBodyMassKg, setLatestBodyMassKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Fields are persisted on every blur; skip the write when nothing changed.
  const lastSaved = useRef(JSON.stringify(fields));

  useEffect(() => {
    if (testType !== 'strength') return;
    void getLatestByType(teamId, playerId, 'growth').then((latest) => {
      setLatestBodyMassKg(latest && latest.testType === 'growth' ? latest.bodyMassKg : null);
    });
  }, [teamId, playerId, testType]);

  function persist(next: PhysicalTestFields) {
    setFields(next);
    const serialized = JSON.stringify(next);
    if (serialized === lastSaved.current) return;
    lastSaved.current = serialized;
    void saveEntryProgress(teamId, sessionId, playerId, testType, next as unknown as Record<string, unknown>);
  }

  const attemptConfig = ATTEMPT_FIELD[testType];
  const attemptLabel = attemptConfig ? s[attemptConfig.label] : '';

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
      setError(s.couldNotConfirmSaved);
      return;
    } finally {
      setSaving(false);
    }
    onFinished();
  }

  const ready = isPhysicalTestReady(testType, fields);

  return (
    <Dialog title={`${t.labels.physicalTest[testType]} — ${playerName}`} onClose={onClose} mobileSheet>
        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="height" className="mb-1 block text-sm font-medium text-ink">{s.height}</label>
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
              <label htmlFor="body-mass" className="mb-1 block text-sm font-medium text-ink">{s.bodyMass}</label>
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
            <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">{s.standingReach}</label>
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
            <div className="mb-5">
              <label htmlFor="shuttle-right" className="mb-1 block text-sm font-medium text-ink">{s.rightFirst}</label>
              <Input
                id="shuttle-right"
                type="number"
                inputMode="decimal"
                step="any"
                className="mb-2 w-full"
                value={fields.rightFirstSeconds}
                onChange={(e) => setFields({ ...fields, rightFirstSeconds: e.target.value })}
                onBlur={() => persist(fields)}
              />
              <Stopwatch onRecord={(s) => persist({ ...fields, rightFirstSeconds: String(s) })} />
            </div>
            <div className="mb-5">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">{s.leftFirst}</label>
              <Input
                id="shuttle-left"
                type="number"
                inputMode="decimal"
                step="any"
                className="mb-2 w-full"
                value={fields.leftFirstSeconds}
                onChange={(e) => setFields({ ...fields, leftFirstSeconds: e.target.value })}
                onBlur={() => persist(fields)}
              />
              <Stopwatch onRecord={(s) => persist({ ...fields, leftFirstSeconds: String(s) })} />
            </div>
          </>
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">{s.mode}</label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={fields.strengthMode}
                onChange={(e) => persist({ ...fields, strengthMode: e.target.value as 'weighted' | 'bodyweight' })}
              >
                <option value="weighted">{s.weighted}</option>
                <option value="bodyweight">{s.bodyweight}</option>
              </select>
            </div>
            {fields.strengthMode === 'weighted' ? (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-exercise" className="mb-1 block text-sm font-medium text-ink">{s.exercise}</label>
                  <select
                    id="strength-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={fields.weightedExercise}
                    onChange={(e) => persist({ ...fields, weightedExercise: e.target.value as WeightedExercise })}
                  >
                    <option value="trapBarDeadlift">{t.labels.strengthExercise.trapBarDeadlift}</option>
                    <option value="squat">{t.labels.strengthExercise.squat}</option>
                    <option value="gobletSquat">{t.labels.strengthExercise.gobletSquat}</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">{s.weight}</label>
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
                  <label htmlFor="strength-bodyweight-exercise" className="mb-1 block text-sm font-medium text-ink">{s.exercise}</label>
                  <select
                    id="strength-bodyweight-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={fields.bodyweightExercise}
                    onChange={(e) => persist({ ...fields, bodyweightExercise: e.target.value as BodyweightExercise })}
                  >
                    <option value="pushUps">{t.labels.strengthExercise.pushUps}</option>
                    <option value="splitSquat">{t.labels.strengthExercise.splitSquat}</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">{s.reps}</label>
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
                  {formatDecimal(value)} {attemptConfig.unit}
                  <button
                    type="button"
                    aria-label={s.removeAttempt(index + 1)}
                    onClick={() => removeAttempt(index)}
                    className="rounded-full p-1 text-red-strong hover:bg-red/10"
                  >
                    x
                  </button>
                </li>
              ))}
            </ul>
            {testType === 'sprint10m' && (
              <div className="mb-3">
                <Stopwatch onRecord={(s) => { setNewAttempt(String(s)); }} />
              </div>
            )}
            <label htmlFor="new-attempt" className="mb-1 block text-sm font-medium text-ink">{attemptLabel}</label>
            <div className="flex items-center gap-3">
              <Input
                id="new-attempt"
                aria-label={attemptLabel}
                type="number"
                inputMode="decimal"
                step="any"
                className="flex-1"
                value={newAttempt}
                onChange={(e) => setNewAttempt(e.target.value)}
              />
              <Button variant="secondary" size="md" onClick={addAttempt} className="shrink-0">
                {s.addAttempt}
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-ink">{s.notes}</label>
          <Textarea id="notes" aria-describedby="notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => persist(fields)} />
          <HealthHint id="notes-hint" />
        </div>

        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>{t.common.close}</Button>
          <Button variant="primary" onClick={() => void handleFinish()} disabled={!ready || saving}>
            {s.finish}
          </Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-strong">{error}</p>}
    </Dialog>
  );
}
