import { STRENGTH_EXERCISE_LABELS } from '../types/physicalTest';
import type { PhysicalTest } from '../types/physicalTest';

export function formatPhysicalTestSummary(test: PhysicalTest): string {
  switch (test.testType) {
    case 'growth':
      return `${test.heightCm} cm, ${test.bodyMassKg} kg`;
    case 'cmj':
      return `${test.bestCm} cm`;
    case 'approachJump':
      return `${test.approachJumpCm} cm (touch ${test.bestTouchCm} cm)`;
    case 'broadJump':
      return `${test.bestCm} cm`;
    case 'sprint10m':
      return `${test.bestSeconds} s`;
    case 'shuttle5105':
      return `R ${test.rightFirstSeconds}s / L ${test.leftFirstSeconds}s`;
    case 'reaction':
      return `${test.reactionTimeMs.toFixed(0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${test.weightKg} kg (${test.bodyMassRatio !== null ? test.bodyMassRatio.toFixed(2) : '—'})`
        : `${test.reps} reps`;
  }
}

export interface PhysicalTestDetailRow {
  label: string;
  value: string;
}

/** Round to at most one decimal place, dropping a trailing ".0". */
function round1(value: number): string {
  return String(Number(value.toFixed(1)));
}

function list(values: number[], unit: string): string {
  return `${values.join(', ')} ${unit}`;
}

/** Every stored measurement for one entry, for the expanded history row. */
export function formatPhysicalTestDetail(test: PhysicalTest): PhysicalTestDetailRow[] {
  switch (test.testType) {
    case 'growth':
      return [
        { label: 'Height', value: `${test.heightCm} cm` },
        { label: 'Body mass', value: `${test.bodyMassKg} kg` },
      ];
    case 'cmj':
      return [
        { label: 'Attempts', value: list(test.attemptsCm, 'cm') },
        { label: 'Best', value: `${test.bestCm} cm` },
      ];
    case 'approachJump':
      return [
        { label: 'Standing reach', value: `${test.standingReachCm} cm` },
        { label: 'Touch attempts', value: list(test.attemptsTouchCm, 'cm') },
        { label: 'Best touch', value: `${test.bestTouchCm} cm` },
        { label: 'Approach jump', value: `${test.approachJumpCm} cm` },
      ];
    case 'broadJump':
      return [
        { label: 'Attempts', value: list(test.attemptsCm, 'cm') },
        { label: 'Best', value: `${test.bestCm} cm` },
      ];
    case 'sprint10m':
      return [
        { label: 'Attempts', value: list(test.attemptsSeconds, 's') },
        { label: 'Best', value: `${test.bestSeconds} s` },
      ];
    case 'shuttle5105':
      return [
        { label: 'Right first', value: `${test.rightFirstSeconds} s` },
        { label: 'Left first', value: `${test.leftFirstSeconds} s` },
      ];
    case 'reaction':
      return [
        { label: 'Attempts', value: list(test.attemptsCm, 'cm') },
        { label: 'Average', value: `${round1(test.averageCm)} cm` },
        { label: 'Reaction time', value: `${test.reactionTimeMs.toFixed(0)} ms` },
      ];
    case 'strength':
      return test.mode === 'weighted'
        ? [
            { label: 'Exercise', value: STRENGTH_EXERCISE_LABELS[test.exercise] },
            { label: 'Weight', value: `${test.weightKg} kg` },
            { label: 'Reps (6RM)', value: String(test.reps6RM) },
            { label: 'Body-mass ratio', value: test.bodyMassRatio !== null ? test.bodyMassRatio.toFixed(2) : '—' },
          ]
        : [
            { label: 'Exercise', value: STRENGTH_EXERCISE_LABELS[test.exercise] },
            { label: 'Reps', value: String(test.reps) },
          ];
  }
}
