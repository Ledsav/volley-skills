import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { it as itCatalog } from '../i18n/it';
import { exerciseImportIssueText } from './exercisesImportMessages';
import { validateExerciseRows } from './exercisesImport';

describe('exercise import issue texts', () => {
  it('keeps the English wording of every issue', () => {
    const text = (rows: unknown[]) => validateExerciseRows(rows).errors.map((i) => exerciseImportIssueText(i, en));
    expect(text(['nope'])).toEqual(['row 1: each entry must be a JSON object']);
    expect(text([{ category: 'game' }])).toEqual(['row 1: "name" is required']);
    expect(text([{ name: 'X', category: 'nonsense' }])).toEqual([
      'row 1: "category" must be one of warmup, physical, service, setting, defense, reception, attack, compound, game',
    ]);
    expect(text([{ name: 'X', category: 'game', description: 5 }])).toEqual(['row 1: "description" must be text']);
    expect(text([{ name: 'X', category: 'game', minPlayers: 99 }])).toEqual(['row 1: "minPlayers" must be a whole number from 1 to 30']);
    expect(text([{ name: 'X', category: 'game', diagrams: 'nope' }])).toEqual(['row 1: "diagrams" must be an array']);
    expect(text([{ name: 'X', category: 'game', diagrams: ['nope'] }])).toEqual(['row 1: diagram 1 must be an object']);
    expect(text([{ name: 'X', category: 'game', diagrams: [{ title: '', scene: {} }] }])).toEqual([
      'row 1: diagram 1: "title" must be 1–40 characters',
      'row 1: diagram 1: scene is invalid (unsupported scene version)',
    ]);
  });

  it('maps the same codes to Italian, with the scene reason translated too', () => {
    const [issue] = validateExerciseRows([{ name: 'X', category: 'game', diagrams: [{ title: 'A', scene: { v: 2 } }] }]).errors;
    expect(exerciseImportIssueText(issue, itCatalog)).toBe('riga 1: diagramma 1: la scena non è valida (versione della scena non supportata)');
  });
});

describe('exercise name hint', () => {
  it('reads the same in English as the shared naming hint', async () => {
    const { EXERCISE_FOCUSES, exerciseNameExample, exerciseNameHint } = await import('../trainings/naming');
    expect(en.exercises.form.nameHint(exerciseNameExample(), EXERCISE_FOCUSES.join(', '))).toBe(exerciseNameHint());
  });
});
