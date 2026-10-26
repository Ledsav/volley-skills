/*
 * Format reference: the file layout was read from the documentation of the openvolley
 * `datavolley` R package (MIT licence). This parser is written independently and copies
 * no code from it or from pydatavolley / py-datavolley.
 */
import { lineList } from './lineList';
import { parseScoutCode } from './parseScoutCode';
import type { DvwError, DvwFile, DvwPlayer, DvwSet, DvwSide, ScoutLine } from './types';

interface Section {
  /** 1-based line number of the first content line in the file. */
  start: number;
  lines: string[];
}

function splitSections(text: string): Map<string, Section> {
  const sections = new Map<string, Section>();
  let current: Section | null = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const header = /^\[3([A-Z0-9-]+)\]\s*$/.exec(line.trim());
    if (header) {
      current = { start: i + 2, lines: [] };
      sections.set(header[1], current);
    } else if (current) {
      current.lines.push(line);
    }
  });
  return sections;
}

const fields = (line: string | undefined): string[] => (line ?? '').split(';').map((f) => f.trim());

function isoDate(raw: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function int(raw: string | undefined): number | null {
  if (raw === undefined || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

function parseSets(lines: string[]): DvwSet[] {
  return lines
    .filter((l) => l.trim() !== '')
    .slice(0, 5)
    .map((l) => {
      const f = fields(l);
      const m = /^(\d+)\s*-\s*(\d+)$/.exec(f[4] ?? '');
      // DataVolley marks unplayed sets True too; only a final score makes a set played.
      return {
        played: (f[0] ?? '').toLowerCase() === 'true' && m !== null,
        home: m ? Number(m[1]) : 0,
        visiting: m ? Number(m[2]) : 0,
      };
    });
}

function parsePlayers(lines: string[], side: DvwSide, warnings: string[]): DvwPlayer[] {
  const players: DvwPlayer[] = [];
  for (const line of lines) {
    if (line.trim() === '') continue;
    const f = fields(line);
    const jersey = int(f[1]);
    if (jersey === null) {
      warnings.push(`Skipped a player line without a jersey number: "${line.trim()}"`);
      continue;
    }
    const role = int(f[13]);
    players.push({
      side,
      jersey,
      fileId: f[8] ?? '',
      lastName: f[9] ?? '',
      firstName: f[10] ?? '',
      specialRole: f[12] === 'L' || f[12] === 'C' ? f[12] : null,
      roleCode: role !== null && role >= 1 && role <= 6 ? (role as DvwPlayer['roleCode']) : 6,
      startingPositions: [3, 4, 5, 6, 7].map((i) => int(f[i])),
    });
  }
  return players;
}

/** A blank line, or one holding only NUL padding (some files end with a stray NUL byte). */
const isBlank = (line: string) => line.replace(/\0/g, '').trim() === '';

/**
 * The set of each line is the running count of `**Nset` markers: lines before the first
 * marker are set 1, lines after the Nth are set N+1 (a marker belongs to the set it ends).
 * Lines after the last marker start a set only if they hold a rally (a skill or point line);
 * otherwise they stay in the last set, so a trailing note never makes a phantom set.
 * Field 9 is only a cross-check: one warning per set where it is empty or disagrees. Marker
 * lines are not checked, since DataVolley writes the next set's number on them.
 */
function parseScout(section: Section, warnings: string[]): ScoutLine[] {
  const out: ScoutLine[] = [];
  const mismatches = new Map<number, number[]>();
  const rows = section.lines
    .map((line, i) => ({ line, lineNo: section.start + i }))
    .filter(({ line }) => !isBlank(line))
    .map(({ line, lineNo }) => ({ f: fields(line), lineNo }))
    .map(({ f, lineNo }) => ({ f, lineNo, code: parseScoutCode(f[0]) }));
  let lastMarker = -1;
  rows.forEach((r, i) => {
    if (r.code.kind === 'setEnd') lastMarker = i;
  });
  const trailingRally = rows.slice(lastMarker + 1).some((r) => r.code.kind === 'skill' || r.code.kind === 'point');
  let markers = 0;
  rows.forEach(({ f, lineNo, code }, i) => {
    const trailing = lastMarker >= 0 && i > lastMarker && !trailingRally;
    const set = trailing ? markers : markers + 1;
    if (code.kind !== 'setEnd' && !trailing && int(f[8]) !== set) mismatches.set(set, [...(mismatches.get(set) ?? []), lineNo]);
    out.push({
      lineNo,
      raw: f[0],
      code,
      set,
      homeCourt: [14, 15, 16, 17, 18, 19].map((k) => int(f[k])),
      visitingCourt: [20, 21, 22, 23, 24, 25].map((k) => int(f[k])),
    });
    if (code.kind === 'setEnd') markers += 1;
  });
  for (const [set, lines] of mismatches) {
    const n = lines.length;
    warnings.push(
      `Set ${set}: ${n} scout ${n === 1 ? 'line has' : 'lines have'} a missing or different set number (${lineList(lines)}); the set markers were used.`,
    );
  }
  return out;
}

export function parseDvw(text: string): DvwFile | DvwError {
  const sections = splitSections(text);
  const match = sections.get('MATCH');
  if (!match) return { error: 'This does not look like a DataVolley file.' };
  const m = fields(match.lines.find((l) => l.trim() !== ''));
  // [3MATCH] regulation: 0 indoor sideout, 1 indoor rally point, 2 beach rally point.
  if (m[9] !== '1') {
    return { error: 'Unsupported regulation: only indoor rally-point matches can be imported.' };
  }
  const scout = sections.get('SCOUT');
  if (!scout || scout.lines.every(isBlank)) {
    return { error: 'This file has no scouted rallies.' };
  }

  const warnings: string[] = [];
  const generatorLine = sections.get('DATAVOLLEYSCOUT')?.lines.find((l) => l.startsWith('GENERATOR-PRG:'));
  const generator = generatorLine ? generatorLine.slice('GENERATOR-PRG:'.length).trim() : '';

  const teamLines = (sections.get('TEAMS')?.lines ?? []).filter((l) => l.trim() !== '');
  const team = (line: string | undefined) => {
    const f = fields(line);
    return { name: f[1] ?? '', setsWon: int(f[2]) ?? 0 };
  };

  return {
    generator,
    date: isoDate(m[0] ?? ''),
    season: m[2] ?? '',
    league: m[3] ?? '',
    teams: { '*': team(teamLines[0]), a: team(teamLines[1]) },
    sets: parseSets(sections.get('SET')?.lines ?? []),
    players: [
      ...parsePlayers(sections.get('PLAYERS-H')?.lines ?? [], '*', warnings),
      ...parsePlayers(sections.get('PLAYERS-V')?.lines ?? [], 'a', warnings),
    ],
    scout: parseScout(scout, warnings),
    warnings,
  };
}
