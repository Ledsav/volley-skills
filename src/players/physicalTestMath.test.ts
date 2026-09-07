import { describe, expect, it } from 'vitest';
import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';

describe('bestOf', () => {
  it('returns the max for jump-type tests', () => {
    expect(bestOf([30, 34, 32], 'max')).toBe(34);
  });

  it('returns the min for time-type tests', () => {
    expect(bestOf([1.85, 1.79, 1.9], 'min')).toBe(1.79);
  });
});

describe('computeApproachJump', () => {
  it('matches the coach\'s worked example: 222cm reach, 267cm best touch, 45cm approach jump', () => {
    const result = computeApproachJump(222, [260, 267, 265]);
    expect(result.bestTouchCm).toBe(267);
    expect(result.approachJumpCm).toBe(45);
  });
});

describe('computeReaction', () => {
  it('discards the min and max of 5 attempts, averages the middle 3, and converts to ms', () => {
    const result = computeReaction([15, 20, 20, 20, 30]);
    expect(result.averageCm).toBe(20);
    expect(result.reactionTimeMs).toBeCloseTo(201.93, 1);
  });
});

describe('computeBodyMassRatio', () => {
  it('matches the coach\'s worked example: 55kg / 50kg = 1.10', () => {
    expect(computeBodyMassRatio(55, 50)).toBeCloseTo(1.1, 2);
  });
});
