import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_CATEGORIES, type ExerciseCategory } from '../types/exercise';
import { diagramFormatGuide } from './diagramPrompt';
import { DRAFT_LIMITS } from './types';

const CATEGORY_LIST = EXERCISE_CATEGORIES.map((c) => c.key).join(', ');

export const EXERCISE_SHAPE = `{"name":string,"category":string,"description":string,"diagram":object}`;

/** Field rules + diagram guide shared by exercise drafting and new exercises inside a training. */
export function exerciseRules(): string {
  return [
    `"category" is one of: ${CATEGORY_LIST}.`,
    `"name" at most ${DRAFT_LIMITS.nameMax} characters. "description" is plain text, at most 1200 characters: setup, how it runs, coaching points, one variation.`,
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
