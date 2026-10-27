import type { PhysicalTest } from '../types/physicalTest';
import { formatNumber } from '../i18n/format';
import { getT } from '../i18n/I18nProvider';

export function formatPhysicalTestSummary(test: PhysicalTest): string {
  const s = getT().players.physical.summary;
  switch (test.testType) {
    case 'growth':
      return `${test.heightCm} cm, ${test.bodyMassKg} kg`;
    case 'cmj':
      return `${test.bestCm} cm`;
    case 'approachJump':
      return s.approachJump(test.approachJumpCm, test.bestTouchCm);
    case 'broadJump':
      return `${test.bestCm} cm`;
    case 'sprint10m':
      return `${test.bestSeconds} s`;
    case 'shuttle5105':
      return s.shuttle(test.rightFirstSeconds, test.leftFirstSeconds);
    case 'reaction':
      return `${formatNumber(test.reactionTimeMs, 0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${test.weightKg} kg (${test.bodyMassRatio !== null ? formatNumber(test.bodyMassRatio, 2) : '—'})`
        : s.reps(test.reps);
  }
}

interface PhysicalTestDetailRow {
  label: string;
  value: string;
}

/** Round to at most one decimal place, dropping a trailing ".0". */
function round1(value: number): string {
  return formatNumber(Number(value.toFixed(1)), 1).replace(/[.,]0$/, '');
}

function list(values: number[], unit: string): string {
  return `${values.join(', ')} ${unit}`;
}

/** Every stored measurement for one entry, for the expanded history row. */
export function formatPhysicalTestDetail(test: PhysicalTest): PhysicalTestDetailRow[] {
  const t = getT();
  const d = t.players.physical.detail;
  const exercises = t.labels.strengthExercise;
  switch (test.testType) {
    case 'growth':
      return [
        { label: d.height, value: `${test.heightCm} cm` },
        { label: d.bodyMass, value: `${test.bodyMassKg} kg` },
      ];
    case 'cmj':
      return [
        { label: d.attempts, value: list(test.attemptsCm, 'cm') },
        { label: d.best, value: `${test.bestCm} cm` },
      ];
    case 'approachJump':
      return [
        { label: d.standingReach, value: `${test.standingReachCm} cm` },
        { label: d.touchAttempts, value: list(test.attemptsTouchCm, 'cm') },
        { label: d.bestTouch, value: `${test.bestTouchCm} cm` },
        { label: d.approachJump, value: `${test.approachJumpCm} cm` },
      ];
    case 'broadJump':
      return [
        { label: d.attempts, value: list(test.attemptsCm, 'cm') },
        { label: d.best, value: `${test.bestCm} cm` },
      ];
    case 'sprint10m':
      return [
        { label: d.attempts, value: list(test.attemptsSeconds, 's') },
        { label: d.best, value: `${test.bestSeconds} s` },
      ];
    case 'shuttle5105':
      return [
        { label: d.rightFirst, value: `${test.rightFirstSeconds} s` },
        { label: d.leftFirst, value: `${test.leftFirstSeconds} s` },
      ];
    case 'reaction':
      return [
        { label: d.attempts, value: list(test.attemptsCm, 'cm') },
        { label: d.average, value: `${round1(test.averageCm)} cm` },
        { label: d.reactionTime, value: `${formatNumber(test.reactionTimeMs, 0)} ms` },
      ];
    case 'strength':
      return test.mode === 'weighted'
        ? [
            { label: d.exercise, value: exercises[test.exercise] },
            { label: d.weight, value: `${test.weightKg} kg` },
            { label: d.reps6RM, value: String(test.reps6RM) },
            { label: d.bodyMassRatio, value: test.bodyMassRatio !== null ? formatNumber(test.bodyMassRatio, 2) : '—' },
          ]
        : [
            { label: d.exercise, value: exercises[test.exercise] },
            { label: d.reps, value: String(test.reps) },
          ];
  }
}
