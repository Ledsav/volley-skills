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
    expect(validateTrainingRows([{ exercises: [] }], map).errors).toEqual([{ code: 'nameRequired', row: 1 }]);
  });

  it('reports a bad durationMinutes', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Butterfly', durationMinutes: 0 }] }],
      map
    );
    expect(result.errors).toEqual([{ code: 'exerciseDuration', row: 1, exercise: 1 }]);
  });

  it('reports an unknown exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Ghost', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual([{ code: 'exerciseNotFound', row: 1, name: 'Ghost' }]);
  });

  it('reports an ambiguous exercise name', () => {
    const result = validateTrainingRows(
      [{ name: 'X', exercises: [{ name: 'Dig', durationMinutes: 5 }] }],
      map
    );
    expect(result.errors).toEqual([{ code: 'exerciseAmbiguous', row: 1, name: 'Dig', count: 2 }]);
  });

  it('rejects a row that lists more than 50 exercises', () => {
    const exercises = Array.from({ length: 51 }, () => ({ name: 'Butterfly', durationMinutes: 10 }));
    const result = validateTrainingRows([{ name: 'Too big', exercises }], map);
    expect(result.errors).toEqual([{ code: 'tooManyExercises', row: 1, max: 50 }]);
    expect(result.inputs).toEqual([]);
  });

  it('accepts a row with exactly 50 valid exercises', () => {
    const exercises = Array.from({ length: 50 }, () => ({ name: 'Butterfly', durationMinutes: 10 }));
    const result = validateTrainingRows([{ name: 'At the limit', exercises }], map);
    expect(result.errors).toEqual([]);
    expect(result.inputs[0].exercises).toHaveLength(50);
  });
  describe('suggestedPlayers and targets', () => {
    const KEYS = ['warmup', 'physical', 'service', 'setting', 'defense', 'reception', 'attack', 'compound', 'game'];

    it('keeps suggestedPlayers and de-duplicated targets', () => {
      const result = validateTrainingRows(
        [{ name: 'C', suggestedPlayers: 12, targets: ['service', 'reception', 'service'] }],
        map
      );
      expect(result.errors).toEqual([]);
      expect(result.inputs[0].suggestedPlayers).toBe(12);
      expect(result.inputs[0].targets).toEqual(['service', 'reception']);
    });

    it('leaves both absent when not given, or when targets is empty', () => {
      const [a, b] = validateTrainingRows([{ name: 'C' }, { name: 'D', targets: [] }], map).inputs;
      expect('suggestedPlayers' in a).toBe(false);
      expect('targets' in a).toBe(false);
      expect('targets' in b).toBe(false);
    });

    it.each([0, 61, 3.5, '12'])('rejects suggestedPlayers %s', (suggestedPlayers) => {
      const result = validateTrainingRows([{ name: 'C', suggestedPlayers }], map);
      expect(result.errors).toEqual([{ code: 'suggestedPlayersRange', row: 1, min: 1, max: 60 }]);
    });

    it.each([['nonsense'], 'service', [3]])('rejects targets %j', (targets) => {
      const result = validateTrainingRows([{ name: 'C', targets }], map);
      expect(result.errors).toEqual([{ code: 'targetsInvalid', row: 1, options: KEYS }]);
    });
  });
});
