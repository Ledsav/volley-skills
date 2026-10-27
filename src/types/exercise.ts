export type ExerciseCategory =
  | 'warmup'
  | 'physical'
  | 'service'
  | 'setting'
  | 'defense'
  | 'reception'
  | 'attack'
  | 'compound'
  | 'game';

/** Category codes in display order; their labels live in the catalog (`labels.exerciseCategory`). */
export const EXERCISE_CATEGORIES: { key: ExerciseCategory }[] = [
  { key: 'warmup' },
  { key: 'physical' },
  { key: 'service' },
  { key: 'setting' },
  { key: 'defense' },
  { key: 'reception' },
  { key: 'attack' },
  { key: 'compound' },
  { key: 'game' },
];

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  /** Fewest people needed to run the drill. Absent => not set (older exercises). */
  minPlayers?: number;
  createdBy: string;
  createdAt: unknown;
}

export interface NewExerciseInput {
  name: string;
  description: string;
  category: ExerciseCategory;
  minPlayers?: number;
}

/** `null` clears the optional field. */
export type ExerciseUpdate = Omit<Partial<NewExerciseInput>, 'minPlayers'> & { minPlayers?: number | null };

export const PLAYER_LIMITS = {
  minPlayers: { min: 1, max: 30 },
  suggestedPlayers: { min: 1, max: 60 },
} as const;
