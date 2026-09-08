import { describe, expect, it } from 'vitest';
import { collectExerciseNames, validateTrainingRows } from './trainingsImport';

describe('collectExerciseNames', () => {
  it('pulls distinct trimmed names out of untrusted rows, skipping junk', () => {
    const names = collectExerciseNames([
      { exercises: [{ name: '  Butterfly  ' }, { name: 'Serve' }, { name: 5 }, 'nope'] },
      { exercises: 'not-an-array' },
      'row-is-a-string',
      { exercises: [{ name: 'Butterfly' }] },
    ]);
    expect(names.sort()).toEqual(['Butterfly', 'Serve']);
  });
});

describe('validateTrainingRows', () => {
  const map = new Map<string, string[]>([
    ['Butterfly', ['ex-1']],
    ['Serve targets', ['ex-2']],
    ['Dig', ['ex-3', 'ex-4']],
  ]);

  it('accepts a valid row, assigns order by position, defaults description/ageGroupTarget', () => {
    const result = validateTrainingRows(
      [
        {
          name: 'Circuit',
          exercises: [
            { name: 'Serve targets', durationMinutes: 10 },
            { name: 'Butterfly', durationMinutes: 15 },
          ],
        },
      ],
      map
    );
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      {
        name: 'Circuit',
        description: '',
        ageGroupTarget: '',
        exercises: [
          { exerciseId: 'ex-2', order: 1, durationMinutes: 10 },
          { exerciseId: 'ex-1', order: 2, durationMinutes: 15 },
        ],
      },
    ]);
  });

  it('accepts a row with no exercises', () => {
    const result = validateTrainingRows([{ name: 'Empty' }], map);
    expect(result.inputs).toEqual([{ name: 'Empty', description: '', ageGroupTarget: '', exercises: [] }]);
  });

  it('reports a missing name', () => {
    expect(validateTrainingRows([{ exercises: [] }], map).errors).toEqual(['row 1: "name" is required']);
  });

  it('reports a bad durationMinutes', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Butterfly', durationMinutes: 0 }] }],
      map
    );
    expect(result.errors).toEqual(['row 1: exercise 1 "durationMinutes" must be a number greater than 0']);
  });

  it('reports an unknown exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Ghost', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual(['row 1: exercise "Ghost" was not found in the library']);
  });

  it('reports an ambiguous exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Dig', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual([
      'row 1: exercise "Dig" is ambiguous — 2 exercises share that name; rename or remove duplicates',
    ]);
  });
});
