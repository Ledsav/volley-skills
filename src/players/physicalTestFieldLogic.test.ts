import { describe, expect, it } from 'vitest';
import { isPhysicalTestReady, buildPhysicalTestInput, type PhysicalTestFields } from './physicalTestFieldLogic';

const BASE: PhysicalTestFields = {
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

describe('isPhysicalTestReady', () => {
  it('growth needs both height and body mass', () => {
    expect(isPhysicalTestReady('growth', BASE)).toBe(false);
    expect(isPhysicalTestReady('growth', { ...BASE, heightCm: '160', bodyMassKg: '50' })).toBe(true);
  });

  it('cmj needs at least 3 attempts', () => {
    expect(isPhysicalTestReady('cmj', { ...BASE, cmjAttempts: [30, 34] })).toBe(false);
    expect(isPhysicalTestReady('cmj', { ...BASE, cmjAttempts: [30, 34, 32] })).toBe(true);
  });

  it('sprint10m needs at least 2 attempts', () => {
    expect(isPhysicalTestReady('sprint10m', { ...BASE, sprintAttempts: [2.1] })).toBe(false);
    expect(isPhysicalTestReady('sprint10m', { ...BASE, sprintAttempts: [2.1, 2.05] })).toBe(true);
  });

  it('shuttle5105 needs both sides', () => {
    expect(isPhysicalTestReady('shuttle5105', { ...BASE, rightFirstSeconds: '5.1' })).toBe(false);
    expect(
      isPhysicalTestReady('shuttle5105', { ...BASE, rightFirstSeconds: '5.1', leftFirstSeconds: '5.3' })
    ).toBe(true);
  });

  it('reaction needs at least 5 attempts', () => {
    expect(isPhysicalTestReady('reaction', { ...BASE, reactionAttempts: [1, 2, 3, 4] })).toBe(false);
    expect(isPhysicalTestReady('reaction', { ...BASE, reactionAttempts: [1, 2, 3, 4, 5] })).toBe(true);
  });

  it('strength needs weightKg when weighted, reps when bodyweight', () => {
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'weighted' })).toBe(false);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'weighted', weightKg: '80' })).toBe(true);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'bodyweight' })).toBe(false);
    expect(isPhysicalTestReady('strength', { ...BASE, strengthMode: 'bodyweight', reps: '12' })).toBe(true);
  });
});

describe('buildPhysicalTestInput', () => {
  it('builds a cmj input with the computed best', () => {
    const input = buildPhysicalTestInput('cmj', { ...BASE, cmjAttempts: [30, 34, 32] }, '2026-09-07', '', null);
    expect(input).toEqual({ testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' });
  });

  it('builds an approachJump input with derived jump height', () => {
    const input = buildPhysicalTestInput(
      'approachJump',
      { ...BASE, standingReachCm: '210', touchAttempts: [260, 265, 258] },
      '2026-09-07',
      '',
      null
    );
    expect(input).toEqual({
      testType: 'approachJump',
      standingReachCm: 210,
      attemptsTouchCm: [260, 265, 258],
      bestTouchCm: 265,
      approachJumpCm: 55,
      date: '2026-09-07',
      notes: '',
    });
  });

  it('builds a weighted strength input with a body-mass ratio when known', () => {
    const input = buildPhysicalTestInput(
      'strength',
      { ...BASE, strengthMode: 'weighted', weightedExercise: 'squat', weightKg: '80' },
      '2026-09-07',
      '',
      50
    );
    expect(input).toEqual({
      testType: 'strength',
      mode: 'weighted',
      exercise: 'squat',
      weightKg: 80,
      reps6RM: 6,
      bodyMassRatio: 1.6,
      date: '2026-09-07',
      notes: '',
    });
  });

  it('builds a bodyweight strength input', () => {
    const input = buildPhysicalTestInput(
      'strength',
      { ...BASE, strengthMode: 'bodyweight', bodyweightExercise: 'splitSquat', reps: '15' },
      '2026-09-07',
      '',
      null
    );
    expect(input).toEqual({
      testType: 'strength',
      mode: 'bodyweight',
      exercise: 'splitSquat',
      reps: 15,
      date: '2026-09-07',
      notes: '',
    });
  });
});
