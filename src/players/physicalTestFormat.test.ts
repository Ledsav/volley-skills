import { describe, expect, it } from 'vitest';
import { formatPhysicalTestSummary } from './physicalTestFormat';

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
