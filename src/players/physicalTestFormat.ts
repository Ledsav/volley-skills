import type { PhysicalTest } from '../types/physicalTest';
import { formatDecimal, formatNumber } from '../i18n/format';
import { getLocale, getT } from '../i18n/I18nProvider';

export function formatPhysicalTestSummary(test: PhysicalTest): string {
  const s = getT().players.physical.summary;
  switch (test.testType) {
    case 'growth':
      return `${formatDecimal(test.heightCm)} cm, ${formatDecimal(test.bodyMassKg)} kg`;
    case 'cmj':
      return `${formatDecimal(test.bestCm)} cm`;
    case 'approachJump':
      return s.approachJump(formatDecimal(test.approachJumpCm), formatDecimal(test.bestTouchCm));
    case 'broadJump':
      return `${formatDecimal(test.bestCm)} cm`;
    case 'sprint10m':
      return `${formatDecimal(test.bestSeconds)} s`;
    case 'shuttle5105':
      return s.shuttle(formatDecimal(test.rightFirstSeconds), formatDecimal(test.leftFirstSeconds));
    case 'reaction':
      return `${formatNumber(test.reactionTimeMs, 0)} ms`;
    case 'strength':
      return test.mode === 'weighted'
        ? `${formatDecimal(test.weightKg)} kg (${test.bodyMassRatio !== null ? formatNumber(test.bodyMassRatio, 2) : '—'})`
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
  // A comma decimal ("2,35") cannot also separate attempts: use "; " there.
  const sep = getLocale() === 'it' ? '; ' : ', ';
  return `${values.map((v) => formatDecimal(v)).join(sep)} ${unit}`;
}

/** Every stored measurement for one entry, for the expanded history row. */
export function formatPhysicalTestDetail(test: PhysicalTest): PhysicalTestDetailRow[] {
  const t = getT();
  const d = t.players.physical.detail;
  const exercises = t.labels.strengthExercise;
  switch (test.testType) {
    case 'growth':
      return [
        { label: d.height, value: `${formatDecimal(test.heightCm)} cm` },
        { label: d.bodyMass, value: `${formatDecimal(test.bodyMassKg)} kg` },
      ];
    case 'cmj':
      return [
        { label: d.attempts, value: list(test.attemptsCm, 'cm') },
        { label: d.best, value: `${formatDecimal(test.bestCm)} cm` },
      ];
    case 'approachJump':
      return [
        { label: d.standingReach, value: `${formatDecimal(test.standingReachCm)} cm` },
        { label: d.touchAttempts, value: list(test.attemptsTouchCm, 'cm') },
        { label: d.bestTouch, value: `${formatDecimal(test.bestTouchCm)} cm` },
        { label: d.approachJump, value: `${formatDecimal(test.approachJumpCm)} cm` },
      ];
    case 'broadJump':
      return [
        { label: d.attempts, value: list(test.attemptsCm, 'cm') },
        { label: d.best, value: `${formatDecimal(test.bestCm)} cm` },
      ];
    case 'sprint10m':
      return [
        { label: d.attempts, value: list(test.attemptsSeconds, 's') },
        { label: d.best, value: `${formatDecimal(test.bestSeconds)} s` },
      ];
    case 'shuttle5105':
      return [
        { label: d.rightFirst, value: `${formatDecimal(test.rightFirstSeconds)} s` },
        { label: d.leftFirst, value: `${formatDecimal(test.leftFirstSeconds)} s` },
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
            { label: d.weight, value: `${formatDecimal(test.weightKg)} kg` },
            { label: d.reps6RM, value: String(test.reps6RM) },
            { label: d.bodyMassRatio, value: test.bodyMassRatio !== null ? formatNumber(test.bodyMassRatio, 2) : '—' },
          ]
        : [
            { label: d.exercise, value: exercises[test.exercise] },
            { label: d.reps, value: String(test.reps) },
          ];
  }
}
