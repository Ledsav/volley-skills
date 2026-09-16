import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea, FIELD_CLASS } from '../components/Input';
import { AttemptsInput } from '../components/AttemptsInput';
import { computeBodyMassRatio } from './physicalTestMath';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from './physicalTestFieldLogic';
import { createPhysicalTest, getLatestByType } from './physicalTestsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { BodyweightExercise, PhysicalTestType, WeightedExercise } from '../types/physicalTest';

interface AddPhysicalTestDialogProps {
  teamId: string;
  playerId: string;
  testType: PhysicalTestType;
  recordedByUid: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AddPhysicalTestDialog({
  teamId,
  playerId,
  testType,
  recordedByUid,
  onClose,
  onSaved,
}: AddPhysicalTestDialogProps) {
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
      setError('Please fill in every attempt before saving.');
      return;
    }

    const input = buildPhysicalTestInput(testType, fields, date, notes, latestBodyMassKg);

    try {
      await createPhysicalTest(teamId, playerId, input, recordedByUid);
    } catch {
      setError('Could not save the test entry. Please try again.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={`Add ${PHYSICAL_TEST_LABELS[testType]} entry`}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface py-6 pl-6 pr-3 shadow-pop [scrollbar-gutter:stable]"
      >
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-ink">Add {PHYSICAL_TEST_LABELS[testType]}</h2>

        <div className="mb-4">
          <label htmlFor="physical-test-date" className="mb-1 block text-sm font-medium text-ink">
            Date
          </label>
          <Input id="physical-test-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full" />
        </div>

        {testType === 'growth' && (
          <>
            <div className="mb-4">
              <label htmlFor="growth-height" className="mb-1 block text-sm font-medium text-ink">
                Height (cm)
              </label>
              <Input
                id="growth-height"
                type="number"
                step="any"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="growth-body-mass" className="mb-1 block text-sm font-medium text-ink">
                Body mass (kg)
              </label>
              <Input
                id="growth-body-mass"
                type="number"
                step="any"
                value={bodyMassKg}
                onChange={(e) => setBodyMassKg(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </>
        )}

        {testType === 'cmj' && (
          <AttemptsInput name="cmj" label="Attempt (cm)" values={cmjAttempts} onChange={setCmjAttempts} minCount={3} />
        )}

        {testType === 'broadJump' && (
          <AttemptsInput
            name="broad-jump"
            label="Attempt (cm)"
            values={broadJumpAttempts}
            onChange={setBroadJumpAttempts}
            minCount={3}
          />
        )}

        {testType === 'approachJump' && (
          <>
            <div className="mb-4">
              <label htmlFor="standing-reach" className="mb-1 block text-sm font-medium text-ink">
                Standing reach (cm)
              </label>
              <Input
                id="standing-reach"
                type="number"
                step="any"
                value={standingReachCm}
                onChange={(e) => setStandingReachCm(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <AttemptsInput
              name="approach-touch"
              label="Touch attempt (cm)"
              values={touchAttempts}
              onChange={setTouchAttempts}
              minCount={3}
            />
          </>
        )}

        {testType === 'sprint10m' && (
          <AttemptsInput
            name="sprint"
            label="Attempt (s)"
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
                Right-first (s)
              </label>
              <Input
                id="shuttle-right"
                type="number"
                step="any"
                value={rightFirstSeconds}
                onChange={(e) => setRightFirstSeconds(e.target.value)}
                required
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="shuttle-left" className="mb-1 block text-sm font-medium text-ink">
                Left-first (s)
              </label>
              <Input
                id="shuttle-left"
                type="number"
                step="any"
                value={leftFirstSeconds}
                onChange={(e) => setLeftFirstSeconds(e.target.value)}
                required
                className="w-full"
              />
            </div>
          </>
        )}

        {testType === 'reaction' && (
          <AttemptsInput
            name="reaction"
            label="Drop attempt (cm)"
            values={reactionAttempts}
            onChange={setReactionAttempts}
            minCount={5}
          />
        )}

        {testType === 'strength' && (
          <>
            <div className="mb-4">
              <label htmlFor="strength-mode" className="mb-1 block text-sm font-medium text-ink">
                Mode
              </label>
              <select
                id="strength-mode"
                className={`${FIELD_CLASS} w-full`}
                value={strengthMode}
                onChange={(e) => setStrengthMode(e.target.value as 'weighted' | 'bodyweight')}
              >
                <option value="weighted">Weighted</option>
                <option value="bodyweight">Bodyweight</option>
              </select>
            </div>
            {strengthMode === 'weighted' ? (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-exercise" className="mb-1 block text-sm font-medium text-ink">
                    Exercise
                  </label>
                  <select
                    id="strength-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={weightedExercise}
                    onChange={(e) => setWeightedExercise(e.target.value as WeightedExercise)}
                  >
                    <option value="trapBarDeadlift">Trap-bar deadlift</option>
                    <option value="squat">Squat</option>
                    <option value="gobletSquat">Goblet squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-weight" className="mb-1 block text-sm font-medium text-ink">
                    Weight (kg)
                  </label>
                  <Input
                    id="strength-weight"
                    type="number"
                    step="any"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>
                <p className="mb-4 text-sm text-slate">
                  {latestBodyMassKg !== null && weightKg !== ''
                    ? `Body-mass ratio: ${computeBodyMassRatio(Number(weightKg), latestBodyMassKg).toFixed(2)}`
                    : 'Body-mass ratio needs a Growth entry with body mass on file.'}
                </p>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label htmlFor="strength-bodyweight-exercise" className="mb-1 block text-sm font-medium text-ink">
                    Exercise
                  </label>
                  <select
                    id="strength-bodyweight-exercise"
                    className={`${FIELD_CLASS} w-full`}
                    value={bodyweightExercise}
                    onChange={(e) => setBodyweightExercise(e.target.value as BodyweightExercise)}
                  >
                    <option value="pushUps">Push-ups</option>
                    <option value="splitSquat">Split squat</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label htmlFor="strength-reps" className="mb-1 block text-sm font-medium text-ink">
                    Reps
                  </label>
                  <Input id="strength-reps" type="number" value={reps} onChange={(e) => setReps(e.target.value)} required className="w-full" />
                </div>
              </>
            )}
          </>
        )}

        <div className="mb-4 mt-4">
          <label htmlFor="physical-test-notes" className="mb-1 block text-sm font-medium text-ink">
            Notes
          </label>
          <Textarea id="physical-test-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" />
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit">
            Save
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-right text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
