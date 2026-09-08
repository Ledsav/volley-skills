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
  createdBy: string;
  createdAt: unknown;
}

export interface NewTrainingInput {
  name: string;
  description: string;
  ageGroupTarget: string;
  exercises: TrainingExercise[];
}
