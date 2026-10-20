import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_CATEGORIES, PLAYER_LIMITS, type ExerciseCategory } from '../types/exercise';
import { diagramFormatGuide } from './diagramPrompt';
import { DRAFT_LIMITS } from './types';
import { EXERCISE_NAME_HINT } from '../trainings/naming';

const CATEGORY_LIST = EXERCISE_CATEGORIES.map((c) => c.key).join(', ');

export const EXERCISE_SHAPE = `{"name":string,"category":string,"minPlayers":number,"description":string,"diagram":object}`;

/** Field rules + diagram guide shared by exercise drafting and new exercises inside a training. */
export function exerciseRules(): string {
  return [
    `"category" is one of: ${CATEGORY_LIST}.`,
    `"name" at most ${DRAFT_LIMITS.nameMax} characters. ${EXERCISE_NAME_HINT}`,
    `"minPlayers" is the fewest players needed to run it, a whole number ${PLAYER_LIMITS.minPlayers.min}-${PLAYER_LIMITS.minPlayers.max}.`,
    '"description" is plain text, at most 1200 characters, as lines starting "Purpose:", "Setup:", "How it runs:", "Coaching points:" (then "- " bullets), "Easier:", "Harder:".',
    'Never include names of real people.',
    diagramFormatGuide(),
  ].join('\n');
}

export function buildExerciseMessages(input: {
  request: string;
  category: ExerciseCategory | null;
  count: number;
  existingNames: string[];
  alreadyProposed: string[];
}): ChatMessage[] {
  const system = [
    'You design volleyball training exercises for a club coach.',
    `Reply only with a JSON object: {"exercises":[${EXERCISE_SHAPE}]}.`,
    exerciseRules(),
    input.existingNames.length
      ? `The club library already has these exercises; do not repeat them: ${input.existingNames.join('; ')}.`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  const user = [
    `Request: ${input.request}`,
    `Count: ${input.count}`,
    `Category: ${input.category ?? 'any'}`,
    input.alreadyProposed.length ? `Already proposed, propose different ones: ${input.alreadyProposed.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
