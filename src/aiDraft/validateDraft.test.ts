import { describe, expect, it } from 'vitest';
import { AiError } from '../ai/aiClient';
import { toDraftScene, validateExerciseDraft, validateExerciseProposals, validateTrainingProposal } from './validateDraft';

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

describe('validateTrainingProposal', () => {
  const index = [
    { id: 'ex-1', name: 'Pepper', category: 'warmup' as const, description: 'Pairs' },
    { id: 'ex-2', name: 'Queen of the court', category: 'game' as const, description: 'Game' },
  ];
  const opts = { index, allowNew: true, ageGroupTarget: 'U15' };

  it('maps library steps and new exercises, clamping minutes', () => {
    const d = validateTrainingProposal(
      {
        name: 'Receive day',
        description: 'Focus on passing',
        ageGroupTarget: 'U17',
        steps: [
          { exerciseId: 'ex-1', minutes: 0 },
          { new: { name: 'Short serve receive', category: 'reception', description: 'x' }, minutes: 25.6 },
          { exerciseId: 'ex-2', minutes: 300 },
        ],
      },
      opts,
    );
    expect(d.name).toBe('Receive day');
    expect(d.ageGroupTarget).toBe('U15');
    expect(d.steps.map((s) => [s.kind, s.minutes])).toEqual([['library', 1], ['new', 26], ['library', 60]]);
    expect(d.steps[0]).toMatchObject({ exerciseId: 'ex-1', name: 'Pepper', category: 'warmup', description: 'Pairs' });
  });

  it('drops unknown and whitespace-padded ids', () => {
    const d = validateTrainingProposal({ name: 'T', steps: [{ exerciseId: ' ex-1 ', minutes: 10 }, { exerciseId: 'made-up', minutes: 10 }, { exerciseId: 'ex-2', minutes: 10 }] }, opts);
    expect(d.steps).toHaveLength(1);
    expect(d.issues).toEqual(['2 steps used exercises that are not in the library and were dropped.']);
  });

  it('drops new exercises when they are not allowed or have no valid category', () => {
    const steps = [{ new: { name: 'A', category: 'game' }, minutes: 10 }, { new: { name: 'B', category: 'nope' }, minutes: 10 }, { exerciseId: 'ex-1', minutes: 10 }];
    expect(validateTrainingProposal({ name: 'T', steps }, { ...opts, allowNew: false }).steps).toHaveLength(1);
    const allowed = validateTrainingProposal({ name: 'T', steps }, opts);
    expect(allowed.steps.map((s) => s.kind)).toEqual(['new', 'library']);
    expect(allowed.issues).toContain('1 new exercise had no valid category and was dropped.');
  });

  it('falls back to a default name, caps steps at 20 and rejects an empty plan', () => {
    const many = Array.from({ length: 30 }, () => ({ exerciseId: 'ex-1', minutes: 5 }));
    const d = validateTrainingProposal({ steps: many }, opts);
    expect(d.name).toBe('AI training');
    expect(d.steps).toHaveLength(20);
    expect(() => validateTrainingProposal({ name: 'T', steps: [] }, opts)).toThrow(AiError);
  });
});
