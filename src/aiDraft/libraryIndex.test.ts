import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import type { Exercise, ExerciseCategory } from '../types/exercise';
import { categoriesForGoal, existingExerciseNames, loadLibraryIndex } from './libraryIndex';

vi.mock('../exercises/exercisesApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const ex = (id: string, category: ExerciseCategory): Exercise => ({
  id, name: `Ex ${id}`, description: `Desc ${id}`, category, createdBy: 'uid-secret', createdAt: null,
});

function pages(total: number, category: ExerciseCategory) {
  let served = 0;
  vi.mocked(exercisesApi.listExercises).mockImplementation(async (_after, cat) => {
    const size = Math.min(25, total - served);
    const exercises = Array.from({ length: size }, (_, i) => ex(`${cat ?? category}-${served + i}`, cat ?? category));
    served += size;
    return { exercises, lastDoc: (size ? {} : null) as never, hasMore: served < total };
  });
}

describe('categoriesForGoal', () => {
  it('maps coaching words to categories and always adds warm-up and game', () => {
    expect(categoriesForGoal('Serve receive for U15')).toEqual(['service', 'reception', 'warmup', 'game']);
    expect(categoriesForGoal('blocking and digging')).toEqual(['defense', 'warmup', 'game']);
  });
  it('returns null when nothing matches (unfiltered library)', () => {
    expect(categoriesForGoal('a fun Friday session')).toBeNull();
  });
});

describe('loadLibraryIndex', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads pages unfiltered up to the 150 cap', async () => {
    pages(400, 'game');
    const index = await loadLibraryIndex('a fun Friday session');
    expect(index).toHaveLength(150);
    expect(exercisesApi.listExercises).toHaveBeenCalledTimes(6);
    expect(vi.mocked(exercisesApi.listExercises).mock.calls.every(([, cat]) => cat === null)).toBe(true);
  });

  it('queries only the matched categories', async () => {
    pages(10, 'game');
    await loadLibraryIndex('serve practice');
    const cats = vi.mocked(exercisesApi.listExercises).mock.calls.map(([, cat]) => cat);
    expect(new Set(cats)).toEqual(new Set(['service', 'warmup', 'game']));
  });

  it('never carries createdBy into the index', async () => {
    pages(3, 'game');
    const index = await loadLibraryIndex('anything');
    expect(JSON.stringify(index)).not.toContain('uid-secret');
    expect(Object.keys(index[0]).sort()).toEqual(['category', 'description', 'id', 'name']);
  });
});

describe('existingExerciseNames', () => {
  beforeEach(() => vi.clearAllMocks());
  it('reads at most two pages and 50 names', async () => {
    pages(200, 'game');
    const names = await existingExerciseNames('game');
    expect(names).toHaveLength(50);
    expect(exercisesApi.listExercises).toHaveBeenCalledTimes(2);
  });
});
