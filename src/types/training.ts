import type { ExerciseCategory } from './exercise';

export interface TrainingExercise {
  exerciseId: string;
  order: number;
  durationMinutes: number;
}

export interface Training {
  id: string;
  businessId: string;
  name: string;
  description: string;
  ageGroupTarget: string;
  exercises: TrainingExercise[];
  exerciseIds: string[];
  /** Planning suggestion ("designed for about N players"), not a head count. Absent => not set. */
  suggestedPlayers?: number;
  /** What the session focuses on, from the exercise categories. Absent => not set. */
  targets?: ExerciseCategory[];
  createdBy: string;
  createdAt: unknown;
}

export interface NewTrainingInput {
  name: string;
  description: string;
  ageGroupTarget: string;
  exercises: TrainingExercise[];
  suggestedPlayers?: number;
  targets?: ExerciseCategory[];
}

/** `null` (or an empty `targets`) clears the optional field. */
export type TrainingUpdate = Omit<Partial<NewTrainingInput>, 'suggestedPlayers' | 'targets'> & {
  suggestedPlayers?: number | null;
  targets?: ExerciseCategory[] | null;
};
