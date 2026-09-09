import { describe, expect, it } from 'vitest';
import { formatPhysicalTestSummary, formatPhysicalTestDetail } from './physicalTestFormat';

const common = { id: 't-1', date: '2026-09-07', notes: '', recordedBy: 'coach-uid', createdAt: null };

describe('formatPhysicalTestSummary', () => {
  it('formats each test type', () => {
    expect(formatPhysicalTestSummary({ ...common, testType: 'growth', heightCm: 160, bodyMassKg: 50 })).toBe('160 cm, 50 kg');
    expect(formatPhysicalTestSummary({ ...common, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34 })).toBe('34 cm');
    expect(
      formatPhysicalTestSummary({
        ...common,
        testType: 'approachJump',
        standingReachCm: 222,
        attemptsTouchCm: [260, 267, 265],
        bestTouchCm: 267,
        approachJumpCm: 45,
      })
    ).toBe('45 cm (touch 267 cm)');
    expect(formatPhysicalTestSummary({ ...common, testType: 'broadJump', attemptsCm: [180, 181, 179], bestCm: 181 })).toBe('181 cm');
    expect(formatPhysicalTestSummary({ ...common, testType: 'sprint10m', attemptsSeconds: [1.85, 1.79], bestSeconds: 1.79 })).toBe('1.79 s');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'shuttle5105', rightFirstSeconds: 5.12, leftFirstSeconds: 5.48 })
    ).toBe('R 5.12s / L 5.48s');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'reaction', attemptsCm: [15, 20, 20, 20, 30], averageCm: 20, reactionTimeMs: 201.93 })
    ).toBe('202 ms');
    expect(
      formatPhysicalTestSummary({
        ...common,
        testType: 'strength',
        mode: 'weighted',
        exercise: 'trapBarDeadlift',
        weightKg: 55,
        reps6RM: 6,
        bodyMassRatio: 1.1,
      })
    ).toBe('55 kg (1.10)');
    expect(
      formatPhysicalTestSummary({ ...common, testType: 'strength', mode: 'bodyweight', exercise: 'pushUps', reps: 25 })
    ).toBe('25 reps');
  });
});

describe('formatPhysicalTestDetail', () => {
  it('lists every stored field for growth', () => {
    expect(formatPhysicalTestDetail({ ...common, testType: 'growth', heightCm: 160, bodyMassKg: 50 })).toEqual([
      { label: 'Height', value: '160 cm' },
      { label: 'Body mass', value: '50 kg' },
    ]);
  });

  it('lists the individual attempts for a jump test, not just the best', () => {
    expect(formatPhysicalTestDetail({ ...common, testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34 })).toEqual([
      { label: 'Attempts', value: '30, 34, 32 cm' },
      { label: 'Best', value: '34 cm' },
    ]);
  });

  it('lists standing reach and touch attempts for an approach jump', () => {
    expect(
      formatPhysicalTestDetail({
        ...common,
        testType: 'approachJump',
        standingReachCm: 222,
        attemptsTouchCm: [260, 267, 265],
        bestTouchCm: 267,
        approachJumpCm: 45,
      })
    ).toEqual([
      { label: 'Standing reach', value: '222 cm' },
      { label: 'Touch attempts', value: '260, 267, 265 cm' },
      { label: 'Best touch', value: '267 cm' },
      { label: 'Approach jump', value: '45 cm' },
    ]);
  });

  it('lists attempts and best for a standing broad jump', () => {
    expect(formatPhysicalTestDetail({ ...common, testType: 'broadJump', attemptsCm: [180, 181, 179], bestCm: 181 })).toEqual([
      { label: 'Attempts', value: '180, 181, 179 cm' },
      { label: 'Best', value: '181 cm' },
    ]);
  });

  it('lists sprint attempts in seconds', () => {
    expect(formatPhysicalTestDetail({ ...common, testType: 'sprint10m', attemptsSeconds: [1.85, 1.79], bestSeconds: 1.79 })).toEqual([
      { label: 'Attempts', value: '1.85, 1.79 s' },
      { label: 'Best', value: '1.79 s' },
    ]);
  });

  it('lists both directions for a 5-10-5 shuttle', () => {
    expect(formatPhysicalTestDetail({ ...common, testType: 'shuttle5105', rightFirstSeconds: 5.12, leftFirstSeconds: 5.48 })).toEqual([
      { label: 'Right first', value: '5.12 s' },
      { label: 'Left first', value: '5.48 s' },
    ]);
  });

  it('lists attempts, average and derived reaction time for a reaction test', () => {
    expect(
      formatPhysicalTestDetail({ ...common, testType: 'reaction', attemptsCm: [15, 20, 20, 20, 30], averageCm: 20, reactionTimeMs: 201.93 })
    ).toEqual([
      { label: 'Attempts', value: '15, 20, 20, 20, 30 cm' },
      { label: 'Average', value: '20 cm' },
      { label: 'Reaction time', value: '202 ms' },
    ]);
  });

  it('rounds a fractional reaction average to one decimal', () => {
    const detail = formatPhysicalTestDetail({
      ...common,
      testType: 'reaction',
      attemptsCm: [15, 21, 22, 23, 30],
      averageCm: 22.333333,
      reactionTimeMs: 213.2,
    });
    expect(detail).toContainEqual({ label: 'Average', value: '22.3 cm' });
  });

  it('names the exercise and shows the 6RM and body-mass ratio for weighted strength', () => {
    expect(
      formatPhysicalTestDetail({
        ...common,
        testType: 'strength',
        mode: 'weighted',
        exercise: 'trapBarDeadlift',
        weightKg: 55,
        reps6RM: 6,
        bodyMassRatio: 1.1,
      })
    ).toEqual([
      { label: 'Exercise', value: 'Trap-bar deadlift' },
      { label: 'Weight', value: '55 kg' },
      { label: 'Reps (6RM)', value: '6' },
      { label: 'Body-mass ratio', value: '1.10' },
    ]);
  });

  it('shows a dash for a missing body-mass ratio', () => {
    const detail = formatPhysicalTestDetail({
      ...common,
      testType: 'strength',
      mode: 'weighted',
      exercise: 'squat',
      weightKg: 40,
      reps6RM: 6,
      bodyMassRatio: null,
    });
    expect(detail).toContainEqual({ label: 'Body-mass ratio', value: '—' });
  });

  it('names the exercise and shows reps for bodyweight strength', () => {
    expect(
      formatPhysicalTestDetail({ ...common, testType: 'strength', mode: 'bodyweight', exercise: 'splitSquat', reps: 25 })
    ).toEqual([
      { label: 'Exercise', value: 'Split squat' },
      { label: 'Reps', value: '25' },
    ]);
  });
});
