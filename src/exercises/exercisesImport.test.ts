import { describe, expect, it } from 'vitest';
import { validateExerciseRows } from './exercisesImport';

describe('validateExerciseRows', () => {
  it('accepts a valid row and defaults description to empty', () => {
    const result = validateExerciseRows([{ name: 'Butterfly', category: 'reception' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual([
      { name: 'Butterfly', description: '', category: 'reception', diagrams: [] },
    ]);
  });

  it('trims the name and keeps a provided description', () => {
    const result = validateExerciseRows([{ name: '  Pepper  ', description: 'control', category: 'warmup' }]);
    expect(result.inputs).toEqual([
      { name: 'Pepper', description: 'control', category: 'warmup', diagrams: [] },
    ]);
  });

  it('ignores unknown top-level keys and still yields an empty diagrams array', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'game', notes: 'ignore me' }]);
    expect(result.errors).toEqual([]);
    expect(result.inputs[0].diagrams).toEqual([]);
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

describe('validateExerciseRows — diagrams', () => {
  const emptyScene = { v: 1, court: 'full', showZones: false, items: [] };

  it('parses a valid diagrams array with sequential order and repaired scenes', () => {
    const result = validateExerciseRows([
      {
        name: 'Weave',
        category: 'reception',
        diagrams: [
          { title: 'Setup', scene: emptyScene },
          { title: '  Rotation  ', scene: emptyScene },
        ],
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toHaveLength(1);
    expect(result.inputs[0].diagrams).toEqual([
      { title: 'Setup', order: 0, scene: { v: 1, court: 'full', showZones: false, items: [] } },
      { title: 'Rotation', order: 1, scene: { v: 1, court: 'full', showZones: false, items: [] } },
    ]);
  });

  it('defaults diagrams to an empty array when the field is absent', () => {
    const result = validateExerciseRows([{ name: 'A', category: 'game' }]);
    expect(result.inputs[0].diagrams).toEqual([]);
  });

  it('rejects a non-array diagrams field with a row-numbered error and no inputs', () => {
    const result = validateExerciseRows([{ name: 'A', category: 'game', diagrams: 'nope' }]);
    expect(result.errors).toEqual(['row 1: "diagrams" must be an array']);
    expect(result.inputs).toEqual([]);
  });

  it('rejects more than 12 diagrams on a single exercise', () => {
    const diagrams = Array.from({ length: 13 }, (_, i) => ({ title: `d${i}`, scene: emptyScene }));
    const result = validateExerciseRows([{ name: 'A', category: 'game', diagrams }]);
    expect(result.errors).toEqual(['row 1: at most 12 diagrams per exercise']);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a non-object diagram entry', () => {
    const result = validateExerciseRows([{ name: 'A', category: 'game', diagrams: ['nope'] }]);
    expect(result.errors).toEqual(['row 1: diagram 1 must be an object']);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a diagram with an invalid scene and drops the whole row', () => {
    const result = validateExerciseRows([
      { name: 'A', category: 'game', diagrams: [{ title: 'Bad', scene: { v: 2 } }] },
    ]);
    expect(result.errors).toEqual(['row 1: diagram 1: scene is invalid (unsupported scene version)']);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a diagram whose title is empty or longer than 40 characters', () => {
    const result = validateExerciseRows([
      { name: 'A', category: 'game', diagrams: [{ title: '', scene: emptyScene }] },
      { name: 'B', category: 'game', diagrams: [{ title: 'x'.repeat(41), scene: emptyScene }] },
    ]);
    expect(result.errors).toEqual([
      'row 1: diagram 1: "title" must be 1–40 characters',
      'row 2: diagram 1: "title" must be 1–40 characters',
    ]);
    expect(result.inputs).toEqual([]);
  });

  it('persists parseScene repairs (clamped values) in the stored diagram scene', () => {
    const result = validateExerciseRows([
      {
        name: 'A',
        category: 'game',
        diagrams: [
          {
            title: 'Setup',
            scene: {
              v: 1,
              court: 'full',
              showZones: false,
              items: [{ id: 'p1', type: 'player', x: 30, y: 70, size: 100 }],
            },
          },
        ],
      },
    ]);
    expect(result.errors).toEqual([]);
    expect(result.inputs[0].diagrams[0].scene.items[0].size).toBe(2);
  });
});
