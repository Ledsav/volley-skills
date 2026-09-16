import { bestOf, computeApproachJump, computeReaction, computeBodyMassRatio } from './physicalTestMath';
import type {
  BodyweightExercise,
  NewPhysicalTestInput,
  PhysicalTestType,
  WeightedExercise,
} from '../types/physicalTest';

export interface PhysicalTestFields {
  heightCm: string;
  bodyMassKg: string;
  cmjAttempts: number[];
  broadJumpAttempts: number[];
  standingReachCm: string;
  touchAttempts: number[];
  sprintAttempts: number[];
  rightFirstSeconds: string;
  leftFirstSeconds: string;
  reactionAttempts: number[];
  strengthMode: 'weighted' | 'bodyweight';
  weightedExercise: WeightedExercise;
  weightKg: string;
  bodyweightExercise: BodyweightExercise;
  reps: string;
}

function filled(attempts: number[], min: number): boolean {
  return attempts.length >= min && attempts.every((v) => !Number.isNaN(v));
}

export function isPhysicalTestReady(testType: PhysicalTestType, fields: PhysicalTestFields): boolean {
  switch (testType) {
    case 'growth':
      return fields.heightCm !== '' && fields.bodyMassKg !== '';
    case 'cmj':
      return filled(fields.cmjAttempts, 3);
    case 'broadJump':
      return filled(fields.broadJumpAttempts, 3);
    case 'approachJump':
      return fields.standingReachCm !== '' && filled(fields.touchAttempts, 3);
    case 'sprint10m':
      return filled(fields.sprintAttempts, 2);
    case 'shuttle5105':
      return fields.rightFirstSeconds !== '' && fields.leftFirstSeconds !== '';
    case 'reaction':
      return filled(fields.reactionAttempts, 5);
    case 'strength':
      return fields.strengthMode === 'weighted' ? fields.weightKg !== '' : fields.reps !== '';
    default:
      return false;
  }
}

export function buildPhysicalTestInput(
  testType: PhysicalTestType,
  fields: PhysicalTestFields,
  date: string,
  notes: string,
  latestBodyMassKg: number | null
): NewPhysicalTestInput {
  if (testType === 'growth') {
    return { testType: 'growth', heightCm: Number(fields.heightCm), bodyMassKg: Number(fields.bodyMassKg), date, notes };
  }
  if (testType === 'cmj') {
    return { testType: 'cmj', attemptsCm: fields.cmjAttempts, bestCm: bestOf(fields.cmjAttempts, 'max'), date, notes };
  }
  if (testType === 'broadJump') {
    return {
      testType: 'broadJump',
      attemptsCm: fields.broadJumpAttempts,
      bestCm: bestOf(fields.broadJumpAttempts, 'max'),
      date,
      notes,
    };
  }
  if (testType === 'approachJump') {
    const { bestTouchCm, approachJumpCm } = computeApproachJump(Number(fields.standingReachCm), fields.touchAttempts);
    return {
      testType: 'approachJump',
      standingReachCm: Number(fields.standingReachCm),
      attemptsTouchCm: fields.touchAttempts,
      bestTouchCm,
      approachJumpCm,
      date,
      notes,
    };
  }
  if (testType === 'sprint10m') {
    return {
      testType: 'sprint10m',
      attemptsSeconds: fields.sprintAttempts,
      bestSeconds: bestOf(fields.sprintAttempts, 'min'),
      date,
      notes,
    };
  }
  if (testType === 'shuttle5105') {
    return {
      testType: 'shuttle5105',
      rightFirstSeconds: Number(fields.rightFirstSeconds),
      leftFirstSeconds: Number(fields.leftFirstSeconds),
      date,
      notes,
    };
  }
  if (testType === 'reaction') {
    const { averageCm, reactionTimeMs } = computeReaction(fields.reactionAttempts);
    return { testType: 'reaction', attemptsCm: fields.reactionAttempts, averageCm, reactionTimeMs, date, notes };
  }
  if (fields.strengthMode === 'weighted') {
    const bodyMassRatio =
      latestBodyMassKg !== null ? computeBodyMassRatio(Number(fields.weightKg), latestBodyMassKg) : null;
    return {
      testType: 'strength',
      mode: 'weighted',
      exercise: fields.weightedExercise,
      weightKg: Number(fields.weightKg),
      reps6RM: 6,
      bodyMassRatio,
      date,
      notes,
    };
  }
  return {
    testType: 'strength',
    mode: 'bodyweight',
    exercise: fields.bodyweightExercise,
    reps: Number(fields.reps),
    date,
    notes,
  };
}
