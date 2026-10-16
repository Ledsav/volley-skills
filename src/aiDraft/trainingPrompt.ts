import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_SHAPE, exerciseRules } from './exercisePrompt';
import { DRAFT_LIMITS, type LibraryIndexEntry } from './types';

/** One library exercise as the model sees it: `id | name | category | first 80 chars`. Nothing else leaves the device. */
export function libraryIndexLine(e: LibraryIndexEntry): string {
  const desc = e.description.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${e.id} | ${e.name} | ${e.category} | ${desc}`;
}

export function buildTrainingMessages(input: {
  goal: string;
  ageGroupTarget: string;
  totalMinutes: number;
  allowNew: boolean;
  index: LibraryIndexEntry[];
}): ChatMessage[] {
  const stepShape = input.allowNew
    ? `{"exerciseId":string,"minutes":number} or {"new":${EXERCISE_SHAPE},"minutes":number}`
    : `{"exerciseId":string,"minutes":number}`;
  const system = [
    'You plan volleyball training sessions for a club coach.',
    `Reply only with a JSON object: {"name":string,"description":string,"ageGroupTarget":string,"steps":[${stepShape}]}.`,
    `Use library exercises by their exact id. Start with a warm-up and end with a game when the library allows. Minutes per step ${DRAFT_LIMITS.minutesMin}-${DRAFT_LIMITS.minutesMax}, at most ${DRAFT_LIMITS.maxSteps} steps, total close to the target.`,
    input.allowNew ? `Only when no library exercise fits, add a new one with "new":\n${exerciseRules()}` : 'Use only library exercises.',
    `Library (id | name | category | description):\n${input.index.length ? input.index.map(libraryIndexLine).join('\n') : '(the library is empty)'}`,
  ].join('\n\n');
  const user = `Goal: ${input.goal}\nAge group: ${input.ageGroupTarget}\nTotal minutes: ${input.totalMinutes}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
