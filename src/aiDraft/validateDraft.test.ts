import { describe, expect, it } from 'vitest';
import { AiError } from '../ai/aiClient';
import { toDraftScene, validateExerciseDraft, validateExerciseProposals } from './validateDraft';

const goodDiagram = {
  court: 'full',
  items: [
    { type: 'player', x: 30, y: 80, label: 'P1', color: 'blue' },
    { type: 'arrow', from: { x: 50, y: 20 }, to: { x: 30, y: 78 }, style: 'shot' },
  ],
};

describe('toDraftScene', () => {
  it('builds a v1 scene with fresh ids', () => {
    const { scene, issues } = toDraftScene(goodDiagram);
    expect(issues).toEqual([]);
    expect(scene?.v).toBe(1);
    expect(scene?.court).toBe('full');
    expect(scene?.items).toHaveLength(2);
    expect(new Set(scene!.items.map((i) => i.id)).size).toBe(2);
  });

  it('drops disallowed and broken items one by one, keeping the rest', () => {
    const { scene, issues } = toDraftScene({
      court: 'half',
      items: [{ type: 'ladder', x: 1, y: 1, rungs: 4, length: 10 }, { type: 'arrow', from: { x: 1 } }, { type: 'cone', x: 20, y: 30 }, 'junk'],
    });
    expect(scene?.items.map((i) => i.type)).toEqual(['cone']);
    expect(issues).toEqual(['3 diagram items were dropped.']);
  });

  it('keeps text when no item survives', () => {
    expect(toDraftScene({ court: 'full', items: [{ type: 'arrow' }] })).toEqual({ scene: null, issues: ['The diagram could not be used.'] });
    expect(toDraftScene(undefined)).toEqual({ scene: null, issues: ['No diagram was proposed.'] });
  });

  it('defaults an unknown court to full and caps the item count', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ type: 'cone', x: i, y: 10 }));
    const { scene } = toDraftScene({ court: 'stadium', items: many });
    expect(scene?.court).toBe('full');
    expect(scene?.items).toHaveLength(60);
  });
});

describe('validateExerciseDraft', () => {
  it('trims and truncates text, keeps a valid category', () => {
    const d = validateExerciseDraft({ name: `  ${'n'.repeat(100)} `, category: 'reception', description: 'd'.repeat(2500), diagram: goodDiagram });
    expect(d?.name).toHaveLength(80);
    expect(d?.description).toHaveLength(2000);
    expect(d?.category).toBe('reception');
    expect(d?.scene).not.toBeNull();
    expect(d?.key).toMatch(/\w+/);
  });

  it('marks an unknown category for the coach to pick', () => {
    const d = validateExerciseDraft({ name: 'X', category: 'blocking', description: '' });
    expect(d?.category).toBeNull();
    expect(d?.issues).toContain('Pick a category.');
  });

  it('rejects a proposal without a name', () => {
    expect(validateExerciseDraft({ name: '  ', category: 'game' })).toBeNull();
    expect(validateExerciseDraft('nope')).toBeNull();
  });
});

describe('validateExerciseProposals', () => {
  it('keeps at most the requested count of valid proposals', () => {
    const raw = { exercises: [{ name: '' }, { name: 'A', category: 'game' }, { name: 'B', category: 'game' }, { name: 'C', category: 'game' }] };
    expect(validateExerciseProposals(raw, 2).map((d) => d.name)).toEqual(['A', 'B']);
  });

  it('throws badResponse when nothing is usable', () => {
    expect(() => validateExerciseProposals({ exercises: [] }, 3)).toThrow(AiError);
    expect(() => validateExerciseProposals({ nope: 1 }, 3)).toThrow(/no usable exercises/);
  });
});
