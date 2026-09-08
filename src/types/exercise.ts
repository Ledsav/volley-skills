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

export const EXERCISE_CATEGORIES: { key: ExerciseCategory; label: string }[] = [
  { key: 'warmup', label: 'Warm-up' },
  { key: 'physical', label: 'Physical' },
  { key: 'service', label: 'Service' },
  { key: 'setting', label: 'Setting' },
  { key: 'defense', label: 'Defense' },
  { key: 'reception', label: 'Reception' },
  { key: 'attack', label: 'Attack' },
  { key: 'compound', label: 'Compound' },
  { key: 'game', label: 'Game' },
];

export interface Exercise {
  id: string;
  name: string;
  description: string;
  category: ExerciseCategory;
  createdBy: string;
  createdAt: unknown;
}

export interface NewExerciseInput {
  name: string;
  description: string;
  category: ExerciseCategory;
}
