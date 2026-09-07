import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Input, Textarea } from '../components/Input';
import { AttemptsInput } from '../components/AttemptsInput';
import { bestOf, computeApproachJump } from './physicalTestMath';
import { createPhysicalTest } from './physicalTestsApi';
import { PHYSICAL_TEST_LABELS } from '../types/physicalTest';
import type { NewPhysicalTestInput, PhysicalTestType } from '../types/physicalTest';

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let input: NewPhysicalTestInput;

    if (testType === 'growth') {
      input = { testType: 'growth', heightCm: Number(heightCm), bodyMassKg: Number(bodyMassKg), date, notes };
    } else if (testType === 'cmj') {
      input = { testType: 'cmj', attemptsCm: cmjAttempts, bestCm: bestOf(cmjAttempts, 'max'), date, notes };
    } else if (testType === 'broadJump') {
      input = {
        testType: 'broadJump',
        attemptsCm: broadJumpAttempts,
        bestCm: bestOf(broadJumpAttempts, 'max'),
        date,
        notes,
      };
    } else if (testType === 'approachJump') {
      const { bestTouchCm, approachJumpCm } = computeApproachJump(Number(standingReachCm), touchAttempts);
      input = {
        testType: 'approachJump',
        standingReachCm: Number(standingReachCm),
        attemptsTouchCm: touchAttempts,
        bestTouchCm,
        approachJumpCm,
        date,
        notes,
      };
    } else {
      // sprint10m / shuttle5105 / reaction / strength are added in Task 16
      return;
    }

    try {
      await createPhysicalTest(teamId, playerId, input, recordedByUid);
    } catch {
      setError('Could not save the test entry. Please try again.');
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <form
        onSubmit={handleSubmit}
        aria-label={`Add ${PHYSICAL_TEST_LABELS[testType]} entry`}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-pop"
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
