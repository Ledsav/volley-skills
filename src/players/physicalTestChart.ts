import type { PhysicalTest, PhysicalTestType } from '../types/physicalTest';

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendSeries {
  points: TrendPoint[];
  unit: string;
  /** True when a lower number is a better result (sprint / shuttle / reaction). */
  lowerIsBetter: boolean;
}

interface Metric {
  unit: string;
  lowerIsBetter: boolean;
}

const METRICS: Record<PhysicalTestType, Metric> = {
  growth: { unit: 'cm', lowerIsBetter: false },
  cmj: { unit: 'cm', lowerIsBetter: false },
  approachJump: { unit: 'cm', lowerIsBetter: false },
  broadJump: { unit: 'cm', lowerIsBetter: false },
  sprint10m: { unit: 's', lowerIsBetter: true },
  shuttle5105: { unit: 's', lowerIsBetter: true },
  reaction: { unit: 'ms', lowerIsBetter: true },
  strength: { unit: 'kg', lowerIsBetter: false },
};

function valueOf(test: PhysicalTest): number {
  switch (test.testType) {
    case 'growth':
      return test.heightCm;
    case 'cmj':
      return test.bestCm;
    case 'approachJump':
      return test.approachJumpCm;
    case 'broadJump':
      return test.bestCm;
    case 'sprint10m':
      return test.bestSeconds;
    case 'shuttle5105':
      return (test.rightFirstSeconds + test.leftFirstSeconds) / 2;
    case 'reaction':
      return test.reactionTimeMs;
    case 'strength':
      return test.mode === 'weighted' ? test.weightKg : test.reps;
  }
}

/**
 * Reduce the history for one test type to a single plottable series. Strength
 * mixes two incomparable modes, so only the most recent mode's entries are kept
 * and the unit follows that mode.
 */
export function buildTrendSeries(testType: PhysicalTestType, tests: PhysicalTest[]): TrendSeries {
  const metric = METRICS[testType];
  const sorted = [...tests].sort((a, b) => a.date.localeCompare(b.date));

  let unit = metric.unit;
  let relevant = sorted;

  if (testType === 'strength') {
    const latest = sorted[sorted.length - 1];
    if (latest && latest.testType === 'strength') {
      relevant = sorted.filter((t) => t.testType === 'strength' && t.mode === latest.mode);
      unit = latest.mode === 'weighted' ? 'kg' : 'reps';
    }
  }

  return {
    points: relevant.map((test) => ({ date: test.date, value: valueOf(test) })),
    unit,
    lowerIsBetter: metric.lowerIsBetter,
  };
}
