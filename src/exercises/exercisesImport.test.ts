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
    expect(result.errors).toEqual([{ code: 'nameRequired', row: 1 }, { code: 'nameRequired', row: 2 }]);
    expect(result.inputs).toEqual([]);
  });

  it('reports an unknown category', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'nonsense' }]);
    expect(result.errors).toEqual([
      { code: 'categoryInvalid', row: 1, options: ['warmup', 'physical', 'service', 'setting', 'defense', 'reception', 'attack', 'compound', 'game'] },
    ]);
  });

  it('reports a non-object row', () => {
    const result = validateExerciseRows(['nope', 42]);
    expect(result.errors).toEqual([{ code: 'notObject', row: 1 }, { code: 'notObject', row: 2 }]);
  });

  it('reports a wrong-typed description', () => {
    const result = validateExerciseRows([{ name: 'X', category: 'warmup', description: 5 }]);
    expect(result.errors).toEqual([{ code: 'descriptionText', row: 1 }]);
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
    expect(result.errors).toEqual([{ code: 'diagramsNotArray', row: 1 }]);
    expect(result.inputs).toEqual([]);
  });

  it('rejects more than 12 diagrams on a single exercise', () => {
    const diagrams = Array.from({ length: 13 }, (_, i) => ({ title: `d${i}`, scene: emptyScene }));
    const result = validateExerciseRows([{ name: 'A', category: 'game', diagrams }]);
    expect(result.errors).toEqual([{ code: 'tooManyDiagrams', row: 1, max: 12 }]);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a non-object diagram entry', () => {
    const result = validateExerciseRows([{ name: 'A', category: 'game', diagrams: ['nope'] }]);
    expect(result.errors).toEqual([{ code: 'diagramNotObject', row: 1, diagram: 1 }]);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a diagram with an invalid scene and drops the whole row', () => {
    const result = validateExerciseRows([
      { name: 'A', category: 'game', diagrams: [{ title: 'Bad', scene: { v: 2 } }] },
    ]);
    expect(result.errors).toEqual([{ code: 'diagramScene', row: 1, diagram: 1, scene: { code: 'unsupportedVersion' } }]);
    expect(result.inputs).toEqual([]);
  });

  it('rejects a diagram whose title is empty or longer than 40 characters', () => {
    const result = validateExerciseRows([
      { name: 'A', category: 'game', diagrams: [{ title: '', scene: emptyScene }] },
      { name: 'B', category: 'game', diagrams: [{ title: 'x'.repeat(41), scene: emptyScene }] },
    ]);
    expect(result.errors).toEqual([
      { code: 'diagramTitle', row: 1, diagram: 1, max: 40 },
      { code: 'diagramTitle', row: 2, diagram: 1, max: 40 },
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
  describe('minPlayers', () => {
    it('keeps a valid minPlayers', () => {
      const result = validateExerciseRows([{ name: 'X', category: 'game', minPlayers: 6 }]);
      expect(result.errors).toEqual([]);
      expect(result.inputs[0].minPlayers).toBe(6);
    });

    it('leaves minPlayers absent when the row has none', () => {
      const result = validateExerciseRows([{ name: 'X', category: 'game' }]);
      expect('minPlayers' in result.inputs[0]).toBe(false);
    });

    it.each([0, 31, 2.5, '6', null])('rejects minPlayers %s', (minPlayers) => {
      const result = validateExerciseRows([{ name: 'X', category: 'game', minPlayers }]);
      expect(result.errors).toEqual([{ code: 'minPlayersRange', row: 1, min: 1, max: 30 }]);
      expect(result.inputs).toEqual([]);
    });
  });
});
