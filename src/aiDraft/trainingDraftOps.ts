import { DRAFT_LIMITS, type TrainingDraft, type TrainingStepDraft } from './types';

export const stepName = (s: TrainingStepDraft) => (s.kind === 'library' ? s.name : s.exercise.name);

export function moveStep(d: TrainingDraft, index: number, delta: number): TrainingDraft {
  const target = index + delta;
  if (target < 0 || target >= d.steps.length) return d;
  const steps = d.steps.slice();
  [steps[index], steps[target]] = [steps[target], steps[index]];
  return { ...d, steps };
}

export function removeStep(d: TrainingDraft, index: number): TrainingDraft {
  return { ...d, steps: d.steps.filter((_, i) => i !== index) };
}

export function setStepMinutes(d: TrainingDraft, index: number, value: number): TrainingDraft {
  const m = Number.isFinite(value) ? Math.round(value) : DRAFT_LIMITS.minutesMin;
  const minutes = Math.max(DRAFT_LIMITS.minutesMin, Math.min(DRAFT_LIMITS.minutesMax, m));
  return { ...d, steps: d.steps.map((s, i) => (i === index ? { ...s, minutes } : s)) };
}

export const totalMinutes = (d: TrainingDraft) => d.steps.reduce((sum, s) => sum + s.minutes, 0);
