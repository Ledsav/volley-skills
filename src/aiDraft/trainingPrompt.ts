import type { ChatMessage } from '../ai/aiClient';
import { EXERCISE_SHAPE, exerciseRules, languageDirective } from './exercisePrompt';
import type { ExerciseCategory } from '../types/exercise';
import { DRAFT_LIMITS, type LibraryIndexEntry } from './types';
import { trainingNameHint } from '../trainings/naming';

/** How far the actual turnout may differ from the suggested number of players. */
const PLAYER_SLACK = 3;

/** One library exercise as the model sees it: `id | name | category | min players | first 80 chars`. Nothing else leaves the device. */
export function libraryIndexLine(e: LibraryIndexEntry): string {
  const desc = e.description.replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${e.id} | ${e.name} | ${e.category} | min ${e.minPlayers ?? '-'} | ${desc}`;
}

export function buildTrainingMessages(input: {
  goal: string;
  ageGroupTarget: string;
  totalMinutes: number;
  allowNew: boolean;
  index: LibraryIndexEntry[];
  targets?: ExerciseCategory[];
  suggestedPlayers?: number | null;
}): ChatMessage[] {
  const stepShape = input.allowNew
    ? `{"exerciseId":string,"minutes":number} or {"new":${EXERCISE_SHAPE},"minutes":number}`
    : `{"exerciseId":string,"minutes":number}`;
  const system = [
    'You plan volleyball training sessions for a club coach.',
    `Reply only with a JSON object: {"name":string,"description":string,"ageGroupTarget":string,"steps":[${stepShape}]}.`,
    `Training "name": ${trainingNameHint()}`,
    `Use library exercises by their exact id. Start with a warm-up and end with a game when the library allows. Minutes per step ${DRAFT_LIMITS.minutesMin}-${DRAFT_LIMITS.minutesMax}, at most ${DRAFT_LIMITS.maxSteps} steps, total close to the target.`,
    'When targets are given, most steps should be in those categories. When a number of players is given, only use exercises whose min players fits the lowest expected turnout.',
    input.allowNew ? `Only when no library exercise fits, add a new one with "new":\n${exerciseRules()}` : 'Use only library exercises.',
    languageDirective(),
    `Library (id | name | category | min players | description):\n${input.index.length ? input.index.map(libraryIndexLine).join('\n') : '(the library is empty)'}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const players = input.suggestedPlayers ?? null;
  const user = [
    `Goal: ${input.goal}`,
    `Age group: ${input.ageGroupTarget}`,
    `Total minutes: ${input.totalMinutes}`,
    input.targets?.length ? `Targets: ${input.targets.join(', ')}` : '',
    players !== null ? `Players: ${players} (plan for ${Math.max(1, players - PLAYER_SLACK)}–${players + PLAYER_SLACK})` : '',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
