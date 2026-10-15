import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { listExercises } from '../exercises/exercisesApi';
import type { Exercise, ExerciseCategory } from '../types/exercise';
import { DRAFT_LIMITS, type LibraryIndexEntry } from './types';

/** Coaching words → category. Order here is the order of the returned list. */
const GOAL_WORDS: [ExerciseCategory, string[]][] = [
  ['warmup', ['warm']],
  ['physical', ['physical', 'fitness', 'conditioning', 'jump', 'agility']],
  ['service', ['serve', 'serving', 'service']],
  ['reception', ['receive', 'reception', 'passing', 'pass']],
  ['setting', ['setting', 'setter', 'set']],
  ['attack', ['attack', 'spike', 'hitting', 'hit']],
  ['defense', ['defense', 'defence', 'dig', 'block']],
  ['compound', ['compound', 'combined', 'transition']],
  ['game', ['game', 'scrimmage', 'match']],
];

export function categoriesForGoal(goal: string): ExerciseCategory[] | null {
  const g = goal.toLowerCase();
  const hits = GOAL_WORDS.filter(([, words]) => words.some((w) => new RegExp(`\\b${w}`).test(g))).map(([c]) => c);
  if (hits.length === 0) return null;
  return [...new Set<ExerciseCategory>([...hits, 'warmup', 'game'])];
}

const toEntry = (e: Exercise): LibraryIndexEntry => ({ id: e.id, name: e.name, category: e.category, description: e.description });

async function collect(category: ExerciseCategory | null, cap: number, maxPages = Infinity): Promise<Exercise[]> {
  const out: Exercise[] = [];
  let after: QueryDocumentSnapshot | null = null;
  for (let page = 0; page < maxPages && out.length < cap; page++) {
    const res = await listExercises(after, category);
    out.push(...res.exercises);
    if (!res.hasMore || !res.lastDoc) break;
    after = res.lastDoc;
  }
  return out.slice(0, cap);
}

/** Bounded library index for a training prompt: matched categories (plus warm-up and game), or the whole library, capped. */
export async function loadLibraryIndex(goal: string): Promise<LibraryIndexEntry[]> {
  const cats = categoriesForGoal(goal);
  if (!cats) return (await collect(null, DRAFT_LIMITS.indexCap)).map(toEntry);
  const out: Exercise[] = [];
  for (const c of cats) {
    if (out.length >= DRAFT_LIMITS.indexCap) break;
    out.push(...(await collect(c, DRAFT_LIMITS.indexCap - out.length)));
  }
  return out.map(toEntry);
}

/** Names the model must not repeat when drafting exercises. */
export async function existingExerciseNames(category: ExerciseCategory | null): Promise<string[]> {
  return (await collect(category, DRAFT_LIMITS.existingNamesCap, 2)).map((e) => e.name);
}
