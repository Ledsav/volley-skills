import { describe, expect, it } from 'vitest';
import { validateExerciseRows } from './exercisesImport';

describe('validateExerciseRows', () => {
  it('accepts a valid row and defaults description to empty', () => {
    const result = validateExerciseRows([{ name: 'Butterfly', category: 'reception' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([{ name: 'Butterfly', description: '', category: 'reception' }]);
  });

  it('trims the name and keeps a provided description', () => {
    const result = validateExerciseRows([{ name: '  Pepper  ', description: 'control', category: 'warmup' }]);
    expect(result.inputs).toEqual([{ name: 'Pepper', description: 'control', category: 'warmup' }]);
  });

  it('ignores unknown top-level keys', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'game', notes: 'ignore me' }]);
    expect(result.errors).toEqual([]);
  });

  it('reports a missing or empty name', () => {
    const result = validateExerciseRows([{ category: 'warmup' }, { name: '   ', category: 'warmup' }]);
    expect(result.errors).toEqual(['row 1: "name" is required', 'row 2: "name" is required']);
    expect(result.inputs).toEqual([]);
  });

  it('reports an unknown category', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'nonsense' }]);
    expect(result.errors).toEqual([
      'row 1: "category" must be one of warmup, physical, service, setting, defense, reception, attack, compound, game',
    ]);
  });

  it('reports a non-object row', () => {
    const result = validateExerciseRows(['nope', 42]);
    expect(result.errors).toEqual(['row 1: each entry must be a JSON object', 'row 2: each entry must be a JSON object']);
  });

  it('reports a wrong-typed description', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'warmup', description: 5 }]);
    expect(result.errors).toEqual(['row 1: "description" must be text']);
  });
});
