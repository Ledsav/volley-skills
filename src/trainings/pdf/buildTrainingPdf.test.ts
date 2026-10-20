import { describe, expect, it, vi } from 'vitest';
import type { Diagram } from '../../types/diagram';
import type { Exercise } from '../../types/exercise';
import type { Training } from '../../types/training';
import { buildLineup, buildTrainingDocDefinition, exercisePages, trainingPdfFileName } from './buildTrainingPdf';

const ex = (id: string, name: string, extra: Partial<Exercise> = {}): Exercise => ({
  id,
  name,
  description: `How to run ${name}.`,
  category: 'service',
  createdBy: 'secret-uid',
  createdAt: null,
  ...extra,
});

const diagram = (id: string, title: string): Diagram => ({
  id,
  title,
  order: 0,
  updatedBy: 'secret-uid',
  updatedAt: null,
  scene: { v: 1, court: 'full', showZones: false, items: [] },
});

const training = (extra: Partial<Training> = {}): Training => ({
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Serve & receive',
  description: 'Line one\nLine two',
  ageGroupTarget: 'U17',
  exercises: [
    { exerciseId: 'a', order: 1, durationMinutes: 10 },
    { exerciseId: 'b', order: 2, durationMinutes: 15 },
    { exerciseId: 'a', order: 3, durationMinutes: 5 },
    { exerciseId: 'gone', order: 4, durationMinutes: 5 },
  ],
  exerciseIds: ['a', 'b', 'a', 'gone'],
  createdBy: 'secret-uid',
  createdAt: null,
  ...extra,
});

const exercisesById = new Map([
  ['a', ex('a', 'Float serve', { minPlayers: 8 })],
  ['b', ex('b', 'Pass to target')],
]);

/** Every node in a pdfmake content tree, depth first. */
function walk(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((n) => walk(n, out));
  else if (node && typeof node === 'object') {
    out.push(node as Record<string, unknown>);
    Object.values(node).forEach((v) => walk(v, out));
  }
  return out;
}

const pageBreaks = (content: unknown) => walk(content).filter((n) => n.pageBreak === 'before').length;

describe('buildLineup', () => {
  it('numbers the slots in order with cumulative start and end minutes', () => {
    const lineup = buildLineup(training(), exercisesById);
    expect(lineup.map((e) => [e.number, e.exerciseId, e.start, e.end])).toEqual([
      [1, 'a', 0, 10],
      [2, 'b', 10, 25],
      [3, 'a', 25, 30],
      [4, 'gone', 30, 35],
    ]);
    expect(lineup[3].name).toBeNull();
    expect(lineup[0].minPlayers).toBe(8);
  });
});

describe('exercisePages', () => {
  it('gives each existing exercise one page, with all its slots, in first-appearance order', () => {
    const pages = exercisePages(buildLineup(training(), exercisesById));
    expect(pages.map((p) => [p.exerciseId, p.slots.map((s) => s.number)])).toEqual([
      ['a', [1, 3]],
      ['b', [2]],
    ]);
  });
});

describe('buildTrainingDocDefinition', () => {
  const svgFor = vi.fn(() => '<svg width="100" height="100"></svg>');
  const diagramsById = new Map([['a', [diagram('d1', 'Setup'), diagram('d2', 'Rotation')]]]);

  it('starts one new page per unique existing exercise and draws every diagram once', () => {
    svgFor.mockClear();
    const def = buildTrainingDocDefinition({ training: training(), exercisesById, diagramsById, svgFor });
    expect(pageBreaks(def.content)).toBe(2);
    expect(svgFor).toHaveBeenCalledTimes(2);
    const json = JSON.stringify(def.content);
    expect(json).toContain('#1, #3 · Float serve');
    expect(json).toContain('#2 · Pass to target');
    expect(json).toContain('Deleted exercise');
    expect(json).toContain('Setup');
  });

  it('leaves out suggested players and targets for a training without them', () => {
    const json = JSON.stringify(
      buildTrainingDocDefinition({ training: training(), exercisesById, diagramsById, svgFor }).content,
    );
    expect(json).not.toMatch(/suggested/i);
    expect(json).not.toContain('Targets');
  });

  it('shows suggested players, targets and a warning for drills needing more players', () => {
    const json = JSON.stringify(
      buildTrainingDocDefinition({
        training: training({ suggestedPlayers: 6, targets: ['service', 'reception'] }),
        exercisesById,
        diagramsById,
        svgFor,
      }).content,
    );
    expect(json).toContain('6 suggested players');
    expect(json).toContain('Targets');
    expect(json).toContain('Reception');
    expect(json).toContain('Needs 8 — suggested 6 players');
  });

  it('exports a cover page only for a training with no exercises', () => {
    const def = buildTrainingDocDefinition({
      training: training({ exercises: [], exerciseIds: [] }),
      exercisesById: new Map(),
      diagramsById: new Map(),
      svgFor,
    });
    expect(pageBreaks(def.content)).toBe(0);
    expect(JSON.stringify(def.content)).toContain('Serve & receive');
  });

  it('is A4 portrait with a page-numbered footer and never carries account data', () => {
    const def = buildTrainingDocDefinition({ training: training(), exercisesById, diagramsById, svgFor });
    expect(def.pageSize).toBe('A4');
    expect(def.pageOrientation).toBe('portrait');
    const footer = def.footer as (page: number, count: number) => unknown;
    expect(JSON.stringify(footer(2, 3))).toContain('Page 2 of 3');
    expect(JSON.stringify(def)).not.toContain('secret-uid');
  });
});

describe('trainingPdfFileName', () => {
  it('uses the business id and a slug of the name', () => {
    expect(trainingPdfFileName(training())).toBe('TR-0007-Serve-receive.pdf');
  });
});
