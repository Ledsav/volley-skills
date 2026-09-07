export type PhysicalTestType =
  | 'growth'
  | 'cmj'
  | 'approachJump'
  | 'broadJump'
  | 'sprint10m'
  | 'shuttle5105'
  | 'reaction'
  | 'strength';

export interface GrowthData {
  testType: 'growth';
  heightCm: number;
  bodyMassKg: number;
}

export interface CmjData {
  testType: 'cmj';
  attemptsCm: number[];
  bestCm: number;
}

export interface ApproachJumpData {
  testType: 'approachJump';
  standingReachCm: number;
  attemptsTouchCm: number[];
  bestTouchCm: number;
  approachJumpCm: number;
}

export interface BroadJumpData {
  testType: 'broadJump';
  attemptsCm: number[];
  bestCm: number;
}

export interface Sprint10mData {
  testType: 'sprint10m';
  attemptsSeconds: number[];
  bestSeconds: number;
}

export interface Shuttle5105Data {
  testType: 'shuttle5105';
  rightFirstSeconds: number;
  leftFirstSeconds: number;
}

export interface ReactionData {
  testType: 'reaction';
  attemptsCm: number[];
  averageCm: number;
  reactionTimeMs: number;
}

export type WeightedExercise = 'trapBarDeadlift' | 'squat' | 'gobletSquat';
export type BodyweightExercise = 'pushUps' | 'splitSquat';

export interface WeightedStrengthData {
  testType: 'strength';
  mode: 'weighted';
  exercise: WeightedExercise;
  weightKg: number;
  reps6RM: 6;
  bodyMassRatio: number | null;
}

export interface BodyweightStrengthData {
  testType: 'strength';
  mode: 'bodyweight';
  exercise: BodyweightExercise;
  reps: number;
}

export type StrengthData = WeightedStrengthData | BodyweightStrengthData;

export type PhysicalTestData =
  | GrowthData
  | CmjData
  | ApproachJumpData
  | BroadJumpData
  | Sprint10mData
  | Shuttle5105Data
  | ReactionData
  | StrengthData;

export interface PhysicalTestCommon {
  id: string;
  date: string;
  notes: string;
  recordedBy: string;
  createdAt: unknown;
}

export type PhysicalTest =
  | (PhysicalTestCommon & GrowthData)
  | (PhysicalTestCommon & CmjData)
  | (PhysicalTestCommon & ApproachJumpData)
  | (PhysicalTestCommon & BroadJumpData)
  | (PhysicalTestCommon & Sprint10mData)
  | (PhysicalTestCommon & Shuttle5105Data)
  | (PhysicalTestCommon & ReactionData)
  | (PhysicalTestCommon & StrengthData);

export type NewPhysicalTestInput = PhysicalTestData & { date: string; notes: string };

export const PHYSICAL_TEST_LABELS: Record<PhysicalTestType, string> = {
  growth: 'Growth',
  cmj: 'Countermovement Jump',
  approachJump: 'Approach Jump',
  broadJump: 'Standing Broad Jump',
  sprint10m: '10m Sprint',
  shuttle5105: '5-10-5 Shuttle',
  reaction: 'Reaction Time',
  strength: 'Strength',
};

export const PHYSICAL_TEST_ORDER: PhysicalTestType[] = [
  'growth',
  'cmj',
  'approachJump',
  'broadJump',
  'sprint10m',
  'shuttle5105',
  'reaction',
  'strength',
];
