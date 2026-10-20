import type { ExerciseCategory } from '../types/exercise';
import type { DiagramItemType, Scene } from '../types/diagram';

export const DRAFT_LIMITS = {
  nameMax: 80,
  descriptionMax: 2000,
  requestMax: 500,
  minutesMin: 1,
  minutesMax: 60,
  maxSteps: 20,
  maxProposals: 5,
  indexCap: 150,
  existingNamesCap: 50,
} as const;

/** Item types the model may place; the rest stay editor-only. */
export const DRAFT_ITEM_TYPES: readonly DiagramItemType[] = ['player', 'ball', 'cone', 'arrow', 'text', 'zoneLabel'];

export interface ExerciseDraft {
  /** Local id; also the key that remembers the saved exercise id across a retry. */
  key: string;
  name: string;
  /** null => the model's category was unusable; the coach must pick one. */
  category: ExerciseCategory | null;
  description: string;
  /** null => the model gave no usable number; the coach can add it later. */
  minPlayers: number | null;
  /** null => no usable diagram. */
  scene: Scene | null;
  issues: string[];
}

export interface LibraryIndexEntry {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** Full description; the prompt line truncates it. */
  description: string;
  minPlayers?: number;
}

export type TrainingStepDraft =
  | { kind: 'library'; exerciseId: string; name: string; category: ExerciseCategory; description: string; minPlayers?: number; minutes: number }
  | { kind: 'new'; exercise: ExerciseDraft; minutes: number };

export interface TrainingDraft {
  name: string;
  description: string;
  ageGroupTarget: string;
  /** The coach's own choices, carried to the saved training. */
  targets: ExerciseCategory[];
  suggestedPlayers: number | null;
  steps: TrainingStepDraft[];
  issues: string[];
}
