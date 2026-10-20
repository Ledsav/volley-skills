import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { fileSlug } from '../../export/exportJson';
import type { Diagram } from '../../types/diagram';
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory } from '../../types/exercise';
import type { Level } from '../../types/player';
import type { Training } from '../../types/training';
import { needsMorePlayers } from '../suggestions';

const CATEGORY_LABEL = Object.fromEntries(EXERCISE_CATEGORIES.map((c) => [c.key, c.label])) as Record<
  ExerciseCategory,
  string
>;

// Light-theme design tokens (src/index.css): a PDF is always printed light.
const INK = '#0F172A';
const SLATE = '#64748B';
const BLUE = '#2865F6';
const BORDER = '#E2E8F0';
const BG = '#F8FAFC';
const WARN = '#C2410C';

// Level band colours (design system: red/orange/blue/green), in their light-theme text shades.
const LEVEL_COLOR: Record<Level, string> = {
  Beginner: '#DC2626',
  Developing: '#C2410C',
  Advanced: '#2865F6',
  Elite: '#0C7C4F',
};

// The embedded font (Roboto) has no arrow glyphs; coaches type them in names and descriptions.
const MISSING_GLYPHS: [RegExp, string][] = [
  [/↔/g, '‹›'],
  [/[→⇒➔]/g, '›'],
  [/[←⇐]/g, '‹'],
];

export function fontSafe(text: string): string {
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
  date?: string;
  general: string;
  players: { name: string; position: string; level: Level | null; note: string }[];
}

export interface TrainingPdfInput {
  training: Training;
  teamNotes?: TeamNotes;
  exercisesById: Map<string, Exercise>;
  diagramsById: Map<string, Diagram[]>;
  /** Turns a saved diagram into an SVG string (injected so this module stays pure). */
  svgFor: (d: Diagram) => string;
}

export interface LineupEntry {
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

function coverPage(training: Training, lineup: LineupEntry[]): Content[] {
  const total = lineup.reduce((sum, e) => sum + e.minutes, 0);
  const facts = [
    training.ageGroupTarget,
    training.suggestedPlayers !== undefined ? `${training.suggestedPlayers} suggested players` : '',
    `${total} min`,
    `${lineup.length} exercise${lineup.length === 1 ? '' : 's'}`,
  ].filter(Boolean);

  const content: Content[] = [
    { text: training.businessId, style: 'label' },
    { text: training.name, style: 'title' },
    { text: facts.join(dot), style: 'facts' },
  ];
  if (training.targets && training.targets.length > 0) {
    content.push({
      text: [{ text: 'Targets  ', bold: true, color: INK }, training.targets.map((t) => CATEGORY_LABEL[t]).join(dot)],
      style: 'facts',
    });
  }
  if (training.description.trim()) content.push({ text: training.description, style: 'body', margin: [0, 8, 0, 0] });

  content.push({ text: 'Session plan', style: 'h2' });
  if (lineup.length === 0) {
    content.push({ text: 'No exercises in this training.', style: 'muted' });
    return content;
  }

  const head = ['#', 'Exercise', 'Category', 'Min players', 'Min', 'Time'].map(
    (text, i): TableCell => ({ text, style: 'th', alignment: i >= 3 ? 'right' : 'left' }),
  );
  const rows = lineup.map((e): TableCell[] => [
    { text: String(e.number), color: SLATE },
    e.name === null ? { text: 'Deleted exercise', color: WARN, italics: true } : { text: e.name, bold: true },
    { text: e.category ? CATEGORY_LABEL[e.category] : '' },
    { text: e.minPlayers !== undefined ? String(e.minPlayers) : '', alignment: 'right' },
    { text: String(e.minutes), alignment: 'right' },
    { text: `${e.start}–${e.end}`, alignment: 'right', color: SLATE },
  ]);
  const totalRow: TableCell[] = [
    '',
    { text: 'Total', bold: true },
    '',
    '',
    { text: String(total), bold: true, alignment: 'right' },
    '',
  ];

  content.push({
    table: { headerRows: 1, dontBreakRows: true, widths: [18, '*', 70, 52, 30, 50], body: [head, ...rows, totalRow] },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => BORDER,
      fillColor: (row: number) => (row === 0 ? BG : null),
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    style: 'table',
  });
  return content;
}

function teamNotesPage(notes: TeamNotes): Content {
  const count = notes.players.length;
  const facts = [notes.teamName, notes.date ?? '', `${count} expected player${count === 1 ? '' : 's'}`].filter(Boolean);
  const stack: Content[] = [
    { text: 'Team notes', style: 'h1' },
    { text: facts.join(dot), style: 'facts' },
  ];
  if (notes.general.trim()) stack.push({ text: notes.general, style: 'body', margin: [0, 10, 0, 0] });
  if (count > 0) {
    const head = ['Player', 'Position', 'Level', 'What to look at'].map((text): TableCell => ({ text, style: 'th' }));
    const rows = notes.players.map((p): TableCell[] => [
      { text: p.name, bold: true },
      { text: p.position, color: SLATE },
      p.level ? { text: p.level, color: LEVEL_COLOR[p.level], bold: true } : { text: 'Not rated', color: SLATE, italics: true },
      { text: p.note },
    ]);
    stack.push({
      table: { headerRows: 1, dontBreakRows: true, widths: [110, 70, 60, '*'], body: [head, ...rows] },
      layout: {
        hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => BORDER,
        fillColor: (row: number) => (row === 0 ? BG : null),
        paddingTop: () => 6,
        paddingBottom: () => 6,
      },
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
  const { training, diagramsById, svgFor } = input;
  const suggested = training.suggestedPlayers ?? null;
  const timing = slots.map((s) => `${s.minutes} min (${s.start}–${s.end})`).join(', ');
  const facts = [
    CATEGORY_LABEL[exercise.category],
    timing,
    exercise.minPlayers !== undefined ? `Min ${exercise.minPlayers} players` : '',
  ].filter(Boolean);

  const stack: Content[] = [
    { text: `${slots.map((s) => `#${s.number}`).join(', ')} · ${exercise.name}`, style: 'h1' },
    { text: facts.join(dot), style: 'facts' },
  ];
  if (needsMorePlayers(exercise.minPlayers, suggested)) {
    stack.push({ text: `Needs ${exercise.minPlayers} — suggested ${suggested} players`, style: 'warn' });
  }
  if (exercise.description.trim()) stack.push({ text: exercise.description, style: 'body', margin: [0, 10, 0, 14] });
  stack.push(...diagramsContent(diagramsById.get(exercise.id) ?? [], svgFor));

  return { stack, pageBreak: 'before' };
}

/** The whole PDF: a cover with the session plan, then one page per exercise with its court diagrams. */
export function buildTrainingDocDefinition(input: TrainingPdfInput): TDocumentDefinitions {
  const { training, exercisesById, teamNotes } = input;
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
      color: SLATE,
      margin: [PAGE_MARGINS[0], 24, PAGE_MARGINS[2], 0],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      fontSize: 8,
      color: SLATE,
      alignment: 'right',
      margin: [PAGE_MARGINS[0], 16, PAGE_MARGINS[2], 0],
    }),
    content: fontSafeTree([...coverPage(training, lineup), ...(teamNotes ? [teamNotesPage(teamNotes)] : []), ...pages]),
    defaultStyle: { fontSize: 10, color: INK, lineHeight: 1.25 },
    styles: {
      label: { fontSize: 9, bold: true, color: BLUE, characterSpacing: 0.5 },
      title: { fontSize: 24, bold: true, margin: [0, 2, 0, 6] },
      h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      h2: { fontSize: 13, bold: true, margin: [0, 20, 0, 8] },
      facts: { fontSize: 10, color: SLATE, margin: [0, 2, 0, 0] },
      body: { fontSize: 11, lineHeight: 1.4 },
      muted: { color: SLATE },
      warn: { fontSize: 10, bold: true, color: WARN, margin: [0, 6, 0, 0] },
      th: { fontSize: 8, bold: true, color: SLATE },
      table: { fontSize: 10 },
      caption: { fontSize: 9, color: SLATE, alignment: 'center', margin: [0, 4, 0, 0] },
    },
  };
}
