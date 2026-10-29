import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Catalog, Gender } from '../../i18n/catalog';
import { fileSlug } from '../../export/exportJson';
import type { Diagram } from '../../types/diagram';
import { type Exercise, type ExerciseCategory } from '../../types/exercise';
import type { Level } from '../../types/player';
import type { Training } from '../../types/training';
import { needsMorePlayers } from '../suggestions';

// Light-theme design tokens (src/index.css): a PDF is always printed light.
const INK = '#1D1D1F';
const INK_2 = '#6E6E73';
const INK_3 = '#8E8E93';
const SEPARATOR = '#DEDEE0';
const WARN = '#C93400';

// Level band colours (design system: red/orange/blue/green), in their light-theme text shades.
const LEVEL_COLOR: Record<Level, string> = {
  Beginner: '#CD0014',
  Developing: '#C93400',
  Advanced: '#0040DD',
  Elite: '#1E7D37',
};

// The embedded font (Roboto) has no arrow glyphs; coaches type them in names and descriptions.
const MISSING_GLYPHS: [RegExp, string][] = [
  [/↔/g, '‹›'],
  [/[→⇒➔]/g, '›'],
  [/[←⇐]/g, '‹'],
];

function fontSafe(text: string): string {
  return MISSING_GLYPHS.reduce((t, [re, to]) => t.replace(re, to), text);
}

/** Applies fontSafe to every printed string (`text` values) in a pdfmake node tree; SVG markup is left alone. */
function fontSafeTree<T>(node: T): T {
  if (Array.isArray(node)) return node.map(fontSafeTree) as T;
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, k === 'text' && typeof v === 'string' ? fontSafe(v) : k === 'svg' ? v : fontSafeTree(v)]),
    ) as T;
  }
  return node;
}

const PAGE_MARGINS: [number, number, number, number] = [40, 56, 40, 48];
const SINGLE_DIAGRAM_WIDTH = 340;
const GRID_DIAGRAM_WIDTH = 250;
const GRID_GAP = 15;

/** Optional page for a session with a known team: who is expected and what to look at for each player. */
export interface TeamNotes {
  teamName: string;
  /** Wording for the level labels ("Avanzato" / "Avanzata"). */
  gender: Gender;
  date?: string;
  general: string;
  players: { name: string; position: string; level: Level | null; note: string }[];
}

interface TrainingPdfInput {
  /** The catalog to print in (passed in so this module stays pure). */
  t: Catalog;
  training: Training;
  teamNotes?: TeamNotes;
  exercisesById: Map<string, Exercise>;
  diagramsById: Map<string, Diagram[]>;
  /** Turns a saved diagram into an SVG string (injected so this module stays pure). */
  svgFor: (d: Diagram) => string;
  /** Width in pt of regular-weight text, for sizing category pills. The default is an estimate of Roboto, the PDF's font (0.56 em per character); a few labels measure wider, so pillMetrics.test.ts pins every catalog label against the real font. */
  measure?: (text: string, fontSize: number) => number;
}

type Measure = NonNullable<TrainingPdfInput['measure']>;
const defaultMeasure: Measure = (s, size) => s.length * size * 0.56;

/** Shared table look: hairline rows, no fills. */
const HAIRLINE = {
  hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
  vLineWidth: () => 0,
  hLineColor: () => SEPARATOR,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

/** An outlined category pill sized to its label; plain text when it would not fit `maxWidth`. */
function chip(label: string, measure: Measure, maxWidth?: number): Content {
  const w = Math.ceil(measure(label, 8)) + 11;
  if (maxWidth !== undefined && w > maxWidth) return { text: label };
  return {
    stack: [
      { canvas: [{ type: 'rect', x: 0, y: 0, w, h: 13, r: 6.5, lineWidth: 0.5, lineColor: INK_3 }] },
      { text: label, fontSize: 8, color: INK, margin: [5, -10.5, 0, 0] },
    ],
    width: w,
    unbreakable: true,
  } as Content;
}

interface LineupEntry {
  number: number;
  exerciseId: string;
  /** null => the exercise was deleted from the library. */
  name: string | null;
  category?: ExerciseCategory;
  minPlayers?: number;
  minutes: number;
  start: number;
  end: number;
}

/** The training's slots in order, with the same start–end minute math as the training view. */
export function buildLineup(training: Training, exercisesById: Map<string, Exercise>): LineupEntry[] {
  let clock = 0;
  return training.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((slot, i) => {
      const ex = exercisesById.get(slot.exerciseId);
      const minutes = slot.durationMinutes || 0;
      const entry: LineupEntry = {
        number: i + 1,
        exerciseId: slot.exerciseId,
        name: ex?.name ?? null,
        category: ex?.category,
        minPlayers: ex?.minPlayers,
        minutes,
        start: clock,
        end: clock + minutes,
      };
      clock += minutes;
      return entry;
    });
}

/** One page per existing exercise, in order of first appearance; a repeated exercise lists all its slots. */
export function exercisePages(lineup: LineupEntry[]): { exerciseId: string; slots: LineupEntry[] }[] {
  const pages = new Map<string, LineupEntry[]>();
  for (const entry of lineup) {
    if (entry.name === null) continue;
    pages.set(entry.exerciseId, [...(pages.get(entry.exerciseId) ?? []), entry]);
  }
  return [...pages].map(([exerciseId, slots]) => ({ exerciseId, slots }));
}

export function trainingPdfFileName(training: Training, date?: string): string {
  return `${training.businessId}-${fileSlug(training.name)}${date ? `-${date}` : ''}.pdf`;
}

const dot = '  ·  ';

function coverPage(training: Training, lineup: LineupEntry[], t: Catalog, measure: Measure): Content[] {
  const p = t.trainings.pdf;
  const total = lineup.reduce((sum, e) => sum + e.minutes, 0);
  const facts = [
    training.ageGroupTarget,
    training.suggestedPlayers !== undefined ? p.suggestedPlayers(training.suggestedPlayers) : '',
    p.minutes(total),
    p.exerciseCount(lineup.length),
  ].filter(Boolean);

  const content: Content[] = [
    { text: training.businessId, style: 'label' },
    { text: training.name, style: 'title' },
    { text: facts.join(dot), style: 'facts' },
  ];
  if (training.targets && training.targets.length > 0) {
    content.push({
      columns: [{ text: p.targets, bold: true, color: INK, width: 'auto' }, ...training.targets.map((target) => chip(t.labels.exerciseCategory[target], measure))],
      columnGap: 4,
      style: 'facts',
    });
  }
  if (training.description.trim()) content.push({ text: training.description, style: 'body', margin: [0, 8, 0, 0] });

  content.push({ text: p.sessionPlan, style: 'h2' });
  if (lineup.length === 0) {
    content.push({ text: p.noExercises, style: 'muted' });
    return content;
  }

  const head = [p.cols.number, p.cols.exercise, p.cols.category, p.cols.minPlayers, p.cols.min, p.cols.time].map(
    (text, i): TableCell => ({ text, style: 'th', alignment: i >= 3 ? 'right' : 'left' }),
  );
  const rows = lineup.map((e): TableCell[] => [
    { text: String(e.number), color: INK_2 },
    e.name === null ? { text: p.deletedExercise, color: WARN, italics: true } : { text: e.name, bold: true },
    e.category ? chip(t.labels.exerciseCategory[e.category], measure, 72) : { text: '' },
    { text: e.minPlayers !== undefined ? String(e.minPlayers) : '', alignment: 'right' },
    { text: String(e.minutes), alignment: 'right' },
    { text: `${e.start}–${e.end}`, alignment: 'right', color: INK_2 },
  ]);
  const totalRow: TableCell[] = [
    '',
    { text: p.total, bold: true },
    '',
    '',
    { text: String(total), bold: true, alignment: 'right' },
    '',
  ];

  content.push({
    table: { headerRows: 1, dontBreakRows: true, widths: [18, '*', 80, 52, 30, 50], body: [head, ...rows, totalRow] },
    layout: HAIRLINE,
    style: 'table',
  });
  return content;
}

function teamNotesPage(notes: TeamNotes, t: Catalog): Content {
  const p = t.trainings.pdf;
  const count = notes.players.length;
  const facts = [notes.teamName, notes.date ?? '', p.expectedPlayers(count, notes.gender)].filter(Boolean);
  const stack: Content[] = [
    { text: p.teamNotes, style: 'h1' },
    { text: facts.join(dot), style: 'facts' },
  ];
  if (notes.general.trim()) stack.push({ text: notes.general, style: 'body', margin: [0, 10, 0, 0] });
  if (count > 0) {
    const head = [p.team.player, p.team.position, p.team.level, p.team.whatToLookAt].map((text): TableCell => ({ text, style: 'th' }));
    const rows = notes.players.map((pl): TableCell[] => [
      { text: pl.name, bold: true },
      { text: pl.position, color: INK_2 },
      pl.level ? { text: t.labels.level[pl.level](notes.gender), color: LEVEL_COLOR[pl.level], bold: true } : { text: p.team.notRated, color: INK_2, italics: true },
      { text: pl.note },
    ]);
    stack.push({
      table: { headerRows: 1, dontBreakRows: true, widths: [110, 90, 60, '*'], body: [head, ...rows] },
      layout: HAIRLINE,
      style: 'table',
      margin: [0, 14, 0, 0],
    });
  }
  return { stack, pageBreak: 'before' };
}

function diagramBlock(d: Diagram, width: number, svgFor: TrainingPdfInput['svgFor']): Content {
  return {
    stack: [
      { svg: svgFor(d), width, alignment: 'center' },
      { text: d.title, style: 'caption' },
    ],
    unbreakable: true,
  };
}

function diagramsContent(diagrams: Diagram[], svgFor: TrainingPdfInput['svgFor']): Content[] {
  if (diagrams.length === 0) return [];
  if (diagrams.length === 1) return [diagramBlock(diagrams[0], SINGLE_DIAGRAM_WIDTH, svgFor)];
  const rows: Content[] = [];
  for (let i = 0; i < diagrams.length; i += 2) {
    const pair = diagrams.slice(i, i + 2);
    rows.push({
      columns: [
        diagramBlock(pair[0], GRID_DIAGRAM_WIDTH, svgFor),
        pair[1] ? diagramBlock(pair[1], GRID_DIAGRAM_WIDTH, svgFor) : { text: '' },
      ],
      columnGap: GRID_GAP,
      unbreakable: true,
      margin: [0, 0, 0, 12],
    });
  }
  return rows;
}

function exercisePage(
  exercise: Exercise,
  slots: LineupEntry[],
  input: TrainingPdfInput,
): Content {
  const { training, diagramsById, svgFor, t } = input;
  const p = t.trainings.pdf;
  const suggested = training.suggestedPlayers ?? null;
  const timing = slots.map((s) => p.slotTiming(s.minutes, s.start, s.end)).join(', ');
  const measure = input.measure ?? defaultMeasure;
  const facts = [
    timing,
    exercise.minPlayers !== undefined ? p.minPlayersFact(exercise.minPlayers) : '',
  ].filter(Boolean);

  const stack: Content[] = [
    { text: `${slots.map((s) => `#${s.number}`).join(', ')} · ${exercise.name}`, style: 'h1' },
    { columns: [chip(t.labels.exerciseCategory[exercise.category], measure), { text: facts.join(dot), style: 'facts', width: '*' }], columnGap: 8 },
  ];
  if (needsMorePlayers(exercise.minPlayers, suggested)) {
    stack.push({ text: p.needsMore(exercise.minPlayers as number, suggested as number), style: 'warn' });
  }
  if (exercise.description.trim()) stack.push({ text: exercise.description, style: 'body', margin: [0, 10, 0, 14] });
  stack.push(...diagramsContent(diagramsById.get(exercise.id) ?? [], svgFor));

  return { stack, pageBreak: 'before' };
}

/** The whole PDF: a cover with the session plan, then one page per exercise with its court diagrams. */
export function buildTrainingDocDefinition(input: TrainingPdfInput): TDocumentDefinitions {
  const { training, exercisesById, teamNotes, t } = input;
  const lineup = buildLineup(training, exercisesById);
  const pages = exercisePages(lineup).map(({ exerciseId, slots }) =>
    exercisePage(exercisesById.get(exerciseId) as Exercise, slots, input),
  );

  return {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: PAGE_MARGINS,
    info: { title: fontSafe(`${training.businessId} · ${training.name}`) },
    header: () => ({
      text: fontSafe(`${training.businessId} · ${training.name}`),
      fontSize: 8,
      color: INK_2,
      margin: [PAGE_MARGINS[0], 24, PAGE_MARGINS[2], 0],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: t.trainings.pdf.page(currentPage, pageCount),
      fontSize: 8,
      color: INK_2,
      alignment: 'right',
      margin: [PAGE_MARGINS[0], 16, PAGE_MARGINS[2], 0],
    }),
    content: fontSafeTree([...coverPage(training, lineup, t, input.measure ?? defaultMeasure), ...(teamNotes ? [teamNotesPage(teamNotes, t)] : []), ...pages]),
    defaultStyle: { fontSize: 10, color: INK, lineHeight: 1.25 },
    styles: {
      label: { fontSize: 9, bold: true, color: INK_2 },
      title: { fontSize: 24, bold: true, characterSpacing: -0.48, margin: [0, 2, 0, 6] },
      h1: { fontSize: 18, bold: true, characterSpacing: -0.31, margin: [0, 0, 0, 4] },
      h2: { fontSize: 13, bold: true, characterSpacing: -0.16, margin: [0, 20, 0, 8] },
      facts: { fontSize: 10, color: INK_2, margin: [0, 2, 0, 0] },
      body: { fontSize: 11, lineHeight: 1.4 },
      muted: { color: INK_2 },
      warn: { fontSize: 10, bold: true, color: WARN, margin: [0, 6, 0, 0] },
      th: { fontSize: 8, bold: true, color: INK_2 },
      table: { fontSize: 10 },
      caption: { fontSize: 9, color: INK_2, alignment: 'center', margin: [0, 4, 0, 0] },
    },
  };
}
