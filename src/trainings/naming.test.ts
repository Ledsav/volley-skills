import { describe, expect, it } from 'vitest';
import { EXERCISE_FOCUSES, EXERCISE_NAME_HINT, followsExerciseNaming, TRAINING_NAME_HINT } from './naming';

describe('naming convention', () => {
  it('recognises "Focus: detail" exercise names', () => {
    expect(followsExerciseNaming('Reception: mixed serves to target')).toBe(true);
    expect(followsExerciseNaming('Free ball: call, drop off and attack')).toBe(true);
    expect(followsExerciseNaming('2 on 2 Reception')).toBe(false);
    expect(followsExerciseNaming('Reception:')).toBe(false);
  });

  it('lists every focus in the hint, and gives a training example', () => {
    for (const f of EXERCISE_FOCUSES) expect(EXERCISE_NAME_HINT).toContain(f);
    expect(TRAINING_NAME_HINT).toContain('Focus + focus: objective');
  });
});
