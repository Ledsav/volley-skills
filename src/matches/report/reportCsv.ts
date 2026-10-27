import { fileSlug } from '../../export/exportJson';
import { GRADES, SKILLS, type Match, type MatchStats, type Skill, type SkillLine } from '../../types/match';
import { rosterMap } from '../format';
import { mergeLines, ratio, serveEff } from '../scoutStats';
import { labelSkill } from '../skillGrades';

export type Cell = string | number | null;

/** `eu`: `;` + decimal comma (French/Dutch/German Excel). `en`: `,` + decimal point (English Excel, Sheets). */
export type CsvFormat = 'eu' | 'en';

const SEPARATOR: Record<CsvFormat, string> = { eu: ';', en: ',' };
const BOM = '﻿';

/** One CSV cell: numbers rounded to 3 places, text quoted per RFC 4180 and guarded against formula injection. */
export function csvCell(value: Cell, format: CsvFormat = 'en'): string {
  if (value === null) return '';
  if (typeof value === 'number') {
    const n = String(Math.round(value * 1000) / 1000);
    return format === 'eu' ? n.replace('.', ',') : n;
  }
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const header = (): Cell[] => [
  'Number',
  'Name',
  ...SKILLS.flatMap((s) => [`${labelSkill(s)} att`, ...GRADES.map((g) => `${labelSkill(s)} ${g}`)]),
  'Attack eff',
  'Serve eff',
  'Reception +',
  'Reception #',
  'Points',
  'Errors',
  'Side-out',
  'Break point',
];

function skillCells(line: SkillLine | undefined): Cell[] {
  return line ? [line.attempts, ...GRADES.map((g) => line.grades[g])] : [0, ...GRADES.map(() => 0)];
}

/** A whole CSV document: BOM (Excel), separator per format, CRLF line ends. */
export function csvDocument(rows: Cell[][], format: CsvFormat): string {
  return BOM + rows.map((row) => row.map((cell) => csvCell(cell, format)).join(SEPARATOR[format])).join('\r\n') + '\r\n';
}

/** The report's player table (one set or the whole match) as an Excel-friendly CSV. */
export function reportCsv(match: Match, stats: MatchStats, format: CsvFormat = 'en'): string {
  const roster = rosterMap(match.roster);
  const players = Object.values(stats.players).sort(
    (a, b) => (roster.get(a.playerId)?.number ?? 0) - (roster.get(b.playerId)?.number ?? 0),
  );
  const rows: Cell[][] = [header()];
  for (const p of players) {
    const entry = roster.get(p.playerId);
    rows.push([
      entry?.number ?? null,
      entry?.name ?? '?',
      ...SKILLS.flatMap((s) => skillCells(p.skills[s])),
      p.attackEff,
      p.serveEff,
      p.receptionPos,
      p.receptionPerfect,
      p.points,
      p.errors,
      null,
      null,
    ]);
  }
  const merged = (s: Skill) => mergeLines(players.map((p) => p.skills[s]));
  const reception = merged('R');
  const t = stats.team;
  rows.push([
    null,
    'Team',
    ...SKILLS.flatMap((s) => skillCells(merged(s))),
    t.attackEff,
    serveEff(merged('S')),
    t.receptionPos,
    reception ? ratio(reception.grades['#'], reception.attempts) : null,
    players.reduce((sum, p) => sum + p.points, 0),
    players.reduce((sum, p) => sum + p.errors, 0),
    ratio(t.sideOut.won, t.sideOut.total),
    ratio(t.breakPoint.won, t.breakPoint.total),
  ]);
  return csvDocument(rows, format);
}

export function reportCsvFileName(match: Match, set: number | 'all'): string {
  return `${match.date}-${fileSlug(match.opponent)}-${set === 'all' ? 'all' : `set${set}`}.csv`;
}
