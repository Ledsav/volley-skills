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
