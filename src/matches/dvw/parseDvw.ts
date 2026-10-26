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
      const m = /^(\d+)-(\d+)$/.exec(f[4] ?? '');
      return {
        played: (f[0] ?? '').toLowerCase() === 'true',
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

function parseScout(section: Section, warnings: string[]): ScoutLine[] {
  const out: ScoutLine[] = [];
  let lastSet = 1;
  section.lines.forEach((line, i) => {
    if (line.trim() === '') return;
    const f = fields(line);
    const lineNo = section.start + i;
    let set = int(f[8]);
    if (set === null || set < 1) {
      warnings.push(`Line ${lineNo}: missing set number, assumed set ${lastSet}.`);
      set = lastSet;
    }
    lastSet = set;
    out.push({
      lineNo,
      raw: f[0],
      code: parseScoutCode(f[0]),
      set,
      homeCourt: [14, 15, 16, 17, 18, 19].map((k) => int(f[k])),
      visitingCourt: [20, 21, 22, 23, 24, 25].map((k) => int(f[k])),
    });
  });
  return out;
}

export function parseDvw(text: string): DvwFile | DvwError {
  const sections = splitSections(text);
  const match = sections.get('MATCH');
  if (!match) return { error: 'This does not look like a DataVolley file.' };
  const m = fields(match.lines.find((l) => l.trim() !== ''));
  if (m[9] !== '2') {
    return { error: 'Unsupported regulation: only indoor rally-point matches can be imported.' };
  }
  const scout = sections.get('SCOUT');
  if (!scout || scout.lines.every((l) => l.trim() === '')) {
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
