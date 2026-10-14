import { describe, expect, it } from 'vitest';
import { FIRST_STEP, nextStep, prevStep, type Step } from './presentSteps';

describe('presentSteps', () => {
  it('walks title → suspense → reveal per award, then final', () => {
    const seq: Step[] = [FIRST_STEP];
    for (let i = 0; i < 6; i++) seq.push(nextStep(seq[seq.length - 1], 2));
    expect(seq).toEqual([
      { kind: 'title', index: 0 }, { kind: 'suspense', index: 0 }, { kind: 'reveal', index: 0 },
      { kind: 'title', index: 1 }, { kind: 'suspense', index: 1 }, { kind: 'reveal', index: 1 },
      { kind: 'final' },
    ]);
    expect(nextStep({ kind: 'final' }, 2)).toEqual({ kind: 'final' });
  });

  it('goes back, stopping at the first step', () => {
    expect(prevStep({ kind: 'final' }, 2)).toEqual({ kind: 'reveal', index: 1 });
    expect(prevStep({ kind: 'title', index: 1 }, 2)).toEqual({ kind: 'reveal', index: 0 });
    expect(prevStep(FIRST_STEP, 2)).toEqual(FIRST_STEP);
  });

  it('zero awards → straight to final', () => {
    expect(nextStep(FIRST_STEP, 0)).toEqual({ kind: 'final' });
  });
});
