import { describe, expect, it } from 'vitest';
import type { GradeCounts, Match, MatchStats, PlayerStats, SkillLine } from '../../types/match';
import { csvCell, reportCsv, reportCsvFileName } from './reportCsv';

const line = (grades: Partial<GradeCounts>): SkillLine => {
  const g: GradeCounts = { '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0, ...grades };
  return { attempts: Object.values(g).reduce((a, b) => a + b, 0), grades: g };
};
const player = (playerId: string, skills: PlayerStats['skills'], extra: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId, skills, points: 0, errors: 0, attackEff: null, serveEff: null, receptionPos: null, receptionPerfect: null, ...extra,
});

const match = {
  id: 'm1', date: '2026-10-18', opponent: 'Rivals / B',
  roster: [
    { playerId: 'a', number: 7, name: 'Ana', positionCategory: 'OH' },
    { playerId: 'b', number: 2, name: 'Bea', positionCategory: 'S' },
  ],
} as unknown as Match;

const stats: MatchStats = {
  players: {
    a: player('a', { S: line({ '#': 1, '=': 1 }) }, { serveEff: 0, points: 1, errors: 1 }),
    b: player('b', { A: line({ '#': 2, '-': 1, '/': 1 }) }, { attackEff: 0.25, points: 2 }),
  },
  team: {
    sideOut: { won: 3, total: 4 }, breakPoint: { won: 1, total: 4 }, oppErrorPoints: 0, rotations: {},
    weakestRotation: null, receptionPos: null, attackEff: 0.25, aces: 1, serveErrors: 1,
  },
  timeoutEffects: [],
  sourceCounts: { tap: 0, text: 0 },
};

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Doe, "Jo"')).toBe('"Doe, ""Jo"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell('plain')).toBe('plain');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('+32 470')).toBe("'+32 470");
    expect(csvCell('-x')).toBe("'-x");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it('writes numbers as numbers and null as blank', () => {
    expect(csvCell(-0.25)).toBe('-0.25');
    expect(csvCell(0.41256)).toBe('0.413');
    expect(csvCell(7)).toBe('7');
    expect(csvCell(null)).toBe('');
  });
});

describe('reportCsv', () => {
  const csv = reportCsv(match, stats);
  const lines = csv.slice(1).split('\r\n');

  it('starts with a BOM and the header, and ends with CRLF', () => {
    expect(csv.startsWith('﻿Number,Name,Serve att,Serve #,Serve +,Serve !,Serve -,Serve /,Serve =,Reception att')).toBe(true);
    expect(lines[0].endsWith(',Attack eff,Serve eff,Reception +,Reception #,Points,Errors,Side-out,Break point')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(lines).toHaveLength(5); // header, 2 players, team, trailing ''
  });

  it('writes one row per player sorted by number', () => {
    const bea = lines[1].split(',');
    expect(bea.slice(0, 2)).toEqual(['2', 'Bea']);
    expect(bea).toHaveLength(59);
    expect(bea.slice(16, 23)).toEqual(['4', '2', '0', '0', '1', '1', '0']); // Attack block
    expect(bea[51]).toBe('0.25'); // attack eff
    expect(bea[52]).toBe(''); // serve eff null
    expect(bea[55]).toBe('2'); // points
    expect(bea[57]).toBe(''); // side-out only on team row
    expect(lines[2].startsWith('7,Ana,2,1,0,0,0,0,1,')).toBe(true);
  });

  it('ends with a team row of summed counts and team rates', () => {
    const team = lines[3].split(',');
    expect(team.slice(0, 2)).toEqual(['', 'Team']);
    expect(team.slice(2, 9)).toEqual(['2', '1', '0', '0', '0', '0', '1']);
    expect(team[51]).toBe('0.25');
    expect(team[52]).toBe('0');
    expect(team[55]).toBe('3');
    expect(team[56]).toBe('1');
    expect(team[57]).toBe('0.75');
    expect(team[58]).toBe('0.25');
  });
});

describe('reportCsvFileName', () => {
  it('names the file by date, opponent and scope', () => {
    expect(reportCsvFileName(match, 'all')).toBe('2026-10-18-Rivals-B-all.csv');
    expect(reportCsvFileName(match, 2)).toBe('2026-10-18-Rivals-B-set2.csv');
  });
});

describe('EU (semicolon) format', () => {
  it('uses ; between cells and a decimal comma', () => {
    expect(csvCell(-0.25, 'eu')).toBe('-0,25');
    expect(csvCell(7, 'eu')).toBe('7');
    expect(csvCell('Doe; Jo', 'eu')).toBe('"Doe; Jo"');
    const lines = reportCsv(match, stats, 'eu').slice(1).split('\r\n');
    expect(lines[0].startsWith('Number;Name;Serve att;')).toBe(true);
    const bea = lines[1].split(';');
    expect(bea).toHaveLength(59);
    expect(bea[51]).toBe('0,25');
  });
});
