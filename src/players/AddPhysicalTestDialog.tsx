import { useEffect, useState, type FormEvent } from 'react';
import { Sheet } from '../components/Sheet';
import { useSave } from '../components/useSave';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { HealthHint } from '../components/HealthHint';
import { AttemptsInput } from '../components/AttemptsInput';
import { computeBodyMassRatio } from './physicalTestMath';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from './physicalTestFieldLogic';
import { createPhysicalTest, getLatestByType } from './physicalTestsApi';
import type { BodyweightExercise, PhysicalTestType, WeightedExercise } from '../types/physicalTest';
import { formatNumber } from '../i18n/format';
import { useT } from '../i18n/I18nProvider';
import { usePlayerSync } from './playerSync';
import { getInitials } from './nameFormat';
import { formatPhysicalTestSummary } from './physicalTestFormat';
import type { PhysicalTest } from '../types/physicalTest';

interface AddPhysicalTestDialogProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  recordedByUid: string;
  onClose: () => void;
  onSaved: () => void;
  /** Who is being tested, for the identity block (screen 8). */
  player?: { fullName: string; number: number };
  /** That player's latest result of this type. */
  latest?: PhysicalTest | null;
}

const STAT_INPUT = 'w-full text-center text-stat tabular-nums';

export function AddPhysicalTestDialog({
  teamId,
  playerId,
  testType,
  recordedByUid,
  onClose,
  onSaved,
  player,
  latest,
}: AddPhysicalTestDialogProps) {
  const t = useT();
  const a = t.players.physical.add;
  const testName = t.labels.physicalTest[testType];
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [heightCm, setHeightCm] = useState('');
  const [bodyMassKg, setBodyMassKg] = useState('');

  const [cmjAttempts, setCmjAttempts] = useState<number[]>([NaN, NaN, NaN]);
  const [broadJumpAttempts, setBroadJumpAttempts] = useState<number[]>([NaN, NaN, NaN]);

  const [standingReachCm, setStandingReachCm] = useState('');
  const [touchAttempts, setTouchAttempts] = useState<number[]>([NaN, NaN, NaN]);

  const [sprintAttempts, setSprintAttempts] = useState<number[]>([NaN, NaN]);
  const [rightFirstSeconds, setRightFirstSeconds] = useState('');
  const [leftFirstSeconds, setLeftFirstSeconds] = useState('');
  const [reactionAttempts, setReactionAttempts] = useState<number[]>([NaN, NaN, NaN, NaN, NaN]);
  const [strengthMode, setStrengthMode] = useState<'weighted' | 'bodyweight'>('weighted');
  const [weightedExercise, setWeightedExercise] = useState<WeightedExercise>('trapBarDeadlift');
  const [weightKg, setWeightKg] = useState('');
  const [bodyweightExercise, setBodyweightExercise] = useState<BodyweightExercise>('pushUps');
  const [reps, setReps] = useState('');
  const [latestBodyMassKg, setLatestBodyMassKg] = useState<number | null>(null);

  useEffect(() => {
    if (testType !== 'strength') return;
    void getLatestByType(teamId, playerId, 'growth').then((latest) => {
      setLatestBodyMassKg(latest && latest.testType === 'growth' ? latest.bodyMassKg : null);
    });
  }, [teamId, playerId, testType]);

  const { saving, save } = useSave();
  const sync = usePlayerSync();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const fields: PhysicalTestFields = {
      heightCm,
      bodyMassKg,
      cmjAttempts,
      broadJumpAttempts,
      standingReachCm,
      touchAttempts,
      sprintAttempts,
      rightFirstSeconds,
      leftFirstSeconds,
      reactionAttempts,
      strengthMode,
      weightedExercise,
      weightKg,
      bodyweightExercise,
      reps,
    };

    if (!isPhysicalTestReady(testType, fields)) {
      setError(a.fillAll);
      return;
    }

    const input = buildPhysicalTestInput(testType, fields, date, notes, latestBodyMassKg);

    try {
      const done = await save(() => createPhysicalTest(teamId, playerId, input, recordedByUid), {
        onQueued: (w) => sync.queued(`test:${testType}`, w),
      });
      if (!done) return;
    } catch {
      setError(a.saveError);
      return;
    }
    onSaved();
  }

  return (
    <Sheet
      title={a.title(testName)}
      onClose={onClose}
      detent="large"
      guardUnsaved
      confirm={{ label: saving ? t.players.shared.saving : t.common.save, form: 'physical-test-form', disabled: saving }}
    >
      {player && (
        <div className="mb-5 flex flex-col items-center gap-1 text-center md:flex-row md:gap-3 md:text-left">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-surface-3 text-headline text-ink-2"
          >
            {getInitials(player.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-headline text-ink">{player.fullName}</p>
            <p className="text-footnote tabular-nums text-ink-2">
              {player.number ? `#${player.number} · ` : ''}
              {latest ? formatPhysicalTestSummary(latest) : t.players.physical.noData}
            </p>
          </div>
        </div>
      )}
      <form id="physical-test-form" onSubmit={handleSubmit} aria-label={a.formLabel(testName)}>

        <div className="mb-4">
          <label htmlFor="physical-test-date" className="mb-1 block text-sm font-medium text-ink">
            {a.date}
          </label>
          <Input id="physical-test-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full" />
        </div>

        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="growth-height" className="mb-1 block text-sm font-medium text-ink">
                {a.heightCm}
              </label>
              <Input
                id="growth-height"
                type="number"
                inputMode="decimal"
                step="any"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
                className={STAT_INPUT}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="growth-body-mass" className="mb-1 block text-sm font-medium text-ink">
                {a.bodyMassKg}
              </label>
              <Input
                id="growth-body-mass"
                type="number"
                inputMode="decimal"
                step="any"
                value={bodyMassKg}
                onChange={(e) => setBodyMassKg(e.target.value)}
                required
                className={STAT_INPUT}
              />
            </div>
          </>
        )}

        {testType === 'cmj' && (
          <AttemptsInput size="stat" name="cmj" label={a.attemptCm} values={cmjAttempts} onChange={setCmjAttempts} minCount={3} />
        )}

        {testType === 'broadJump' && (
          <AttemptsInput
            size="stat"
            name="broad-jump"
            label={a.attemptCm}
            values={broadJumpAttempts}
            onChange={setBroadJumpAttempts}
            minCount={3}
          />
        )}

        {testType === 'approachJump' && (
          <>
            <div className="mb-4">
              <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">
                {a.standingReachCm}
              </label>
              <Input
                id="standing-reach"
                type="number"
                inputMode="decimal"
                step="any"
                value={standingReachCm}
                onChange={(e) => setStandingReachCm(e.target.value)}
                required
                className={STAT_INPUT}
              />
            </div>
            <AttemptsInput
            size="stat"
              name="approach-touch"
              label={a.touchAttemptCm}
              values={touchAttempts}
              onChange={setTouchAttempts}
              minCount={3}
            />
          </>
        )}

        {testType === 'sprint10m' && (
          <AttemptsInput
            size="stat"
            name="sprint"
            label={a.attemptS}
            values={sprintAttempts}
            onChange={setSprintAttempts}
            minCount={2}
            maxCount={3}
          />
        )}

        {testType === 'shuttle5105' && (
          <>
            <div className="mb-4">
              <label htmlFor="shuttle-right" className="mb-1 block text-sm font-medium text-ink">
                {a.rightFirstS}
              </label>
              <Input
                id="shuttle-right"
                type="number"
                inputMode="decimal"
                step="any"
                value={rightFirstSeconds}
                onChange={(e) => setRightFirstSeconds(e.target.value)}
                required
                className={STAT_INPUT}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">
                {a.leftFirstS}
              </label>
              <Input
                id="shuttle-left"
                type="number"
                inputMode="decimal"
                step="any"
                value={leftFirstSeconds}
                onChange={(e) => setLeftFirstSeconds(e.target.value)}
                required
                className={STAT_INPUT}
              />
            </div>
          </>
        )}

        {testType === 'reaction' && (
          <AttemptsInput
            size="stat"
            name="reaction"
            label={a.dropAttemptCm}
            values={reactionAttempts}
            onChange={setReactionAttempts}
            minCount={5}
          />
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">
                {a.mode}
              </label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={strengthMode}
                onChange={(e) => setStrengthMode(e.target.value as 'weighted' | 'bodyweight')}
              >
                <option value="weighted">{a.weighted}</option>
                <option value="bodyweight">{a.bodyweight}</option>
              </select>
            </div>
            {strengthMode === 'weighted' ? (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-exercise" className="mb-1 block text-sm font-medium text-ink">
                    {a.exercise}
                  </label>
                  <select
                    id="strength-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={weightedExercise}
                    onChange={(e) => setWeightedExercise(e.target.value as WeightedExercise)}
                  >
                    <option value="trapBarDeadlift">{t.labels.strengthExercise.trapBarDeadlift}</option>
                    <option value="squat">{t.labels.strengthExercise.squat}</option>
                    <option value="gobletSquat">{t.labels.strengthExercise.gobletSquat}</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">
                    {a.weightKg}
                  </label>
                  <Input
                    id="strength-weight"
                    type="number"
                inputMode="decimal"
                    step="any"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className={STAT_INPUT}
                  />
                </div>
                <p className="mb-4 text-callout tabular-nums text-ink-2">
                  {latestBodyMassKg !== null && weightKg !== ''
                    ? a.ratio(formatNumber(computeBodyMassRatio(Number(weightKg), latestBodyMassKg), 2))
                    : a.ratioNeeds}
                </p>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-bodyweight-exercise" className="mb-1 block text-sm font-medium text-ink">
                    {a.exercise}
                  </label>
                  <select
                    id="strength-bodyweight-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={bodyweightExercise}
                    onChange={(e) => setBodyweightExercise(e.target.value as BodyweightExercise)}
                  >
                    <option value="pushUps">{t.labels.strengthExercise.pushUps}</option>
                    <option value="splitSquat">{t.labels.strengthExercise.splitSquat}</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">
                    {a.reps}
                  </label>
                  <Input id="strength-reps" type="number" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} required className={STAT_INPUT} />
                </div>
              </>
            )}
          </>
        )}

        <div className="mb-4 mt-4">
          <label htmlFor="physical-test-notes" className="mb-1 block text-sm font-medium text-ink">
            {a.notes}
          </label>
          <Textarea id="physical-test-notes" aria-describedby="physical-test-notes-hint" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />
          <HealthHint id="physical-test-notes-hint" />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-strong">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
