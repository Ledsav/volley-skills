import { describe, expect, it } from 'vitest';
import { moveStep, removeStep, setStepMinutes, stepName, totalMinutes } from './trainingDraftOps';
import type { TrainingDraft } from './types';

const d: TrainingDraft = {
  name: 'T',
  description: '',
  ageGroupTarget: '',
  targets: [],
  suggestedPlayers: null,
  issues: [],
  steps: [
    { kind: 'library', exerciseId: 'a', name: 'A', category: 'warmup', description: '', minutes: 10 },
    { kind: 'new', exercise: { key: 'k', name: 'B', category: 'game', minPlayers: null, description: '', scene: null, issues: [] }, minutes: 20 },
  ],
};

describe('trainingDraftOps', () => {
  it('moves within bounds and ignores moves past the ends', () => {
    expect(moveStep(d, 0, 1).steps.map(stepName)).toEqual(['B', 'A']);
    expect(moveStep(d, 0, -1)).toBe(d);
  });
  it('removes a step and totals minutes', () => {
    expect(removeStep(d, 0).steps.map(stepName)).toEqual(['B']);
    expect(totalMinutes(d)).toBe(30);
  });
  it('clamps edited minutes to 1–60', () => {
    expect(setStepMinutes(d, 0, 0).steps[0].minutes).toBe(1);
    expect(setStepMinutes(d, 0, 99).steps[0].minutes).toBe(60);
    expect(setStepMinutes(d, 0, Number.NaN).steps[0].minutes).toBe(1);
  });
});
