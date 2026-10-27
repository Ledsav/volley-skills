// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadFixture } from './loadFixture';
import { parseDvw } from './parseDvw';
import type { DvwFile } from './types';

function parsed(name: string): DvwFile {
  const result = parseDvw(loadFixture(name));
  if ('error' in result) throw new Error(result.error.code);
  return result;
}

describe('parseDvw: three-sets-home', () => {
  const file = parsed('three-sets-home.dvw');

  it('reads the match header', () => {
    expect(file.generator).toBe('Fixture Maker 1.0');
    expect(file.date).toBe('2026-10-18');
    expect(file.season).toBe('2026/2027');
    expect(file.league).toBe('Test League');
  });

  it('reads the teams', () => {
    expect(file.teams['*']).toEqual({ name: 'Volley Club Test', setsWon: 3 });
    expect(file.teams.a).toEqual({ name: 'Rivali Uno', setsWon: 0 });
  });

  it('reads the final score of each played set', () => {
    expect(file.sets).toHaveLength(5);
    expect(file.sets.filter((s) => s.played).map((s) => [s.home, s.visiting])).toEqual([
      [25, 20],
      [25, 18],
      [25, 22],
    ]);
    expect(file.sets[3]).toEqual({ played: false, home: 0, visiting: 0 });
  });

  it('reads players with roles and starting positions', () => {
    const home = file.players.filter((p) => p.side === '*');
    expect(home).toHaveLength(12);
    expect(file.players.filter((p) => p.side === 'a')).toHaveLength(12);
    const libero = home.find((p) => p.specialRole === 'L');
    expect(libero).toMatchObject({ jersey: 4, lastName: 'Gallard', firstName: 'Hugo', roleCode: 1, fileId: 'T007' });
    expect(libero?.startingPositions).toEqual([null, null, null, null, null]);
    const setter = home.find((p) => p.jersey === 11);
    expect(setter).toMatchObject({ roleCode: 5, specialRole: null });
    expect(setter?.startingPositions).toEqual([2, 2, 2, null, null]);
    expect(home.find((p) => p.specialRole === 'C')?.jersey).toBe(1);
  });

  it('reads scout lines with set number and both courts', () => {
    const first = file.scout[0];
    expect(first.set).toBe(1);
    expect(first.raw).toBe('*P11>LUp');
    expect(first.homeCourt).toEqual([7, 11, 3, 5, 8, 9]);
    expect(first.visitingCourt).toEqual([10, 6, 9, 12, 7, 11]);
    expect(first.code).toEqual({ kind: 'other', reason: 'lineupMarker' });
    expect(new Set(file.scout.map((l) => l.set))).toEqual(new Set([1, 2, 3]));
    expect(file.scout.every((l) => l.lineNo > 0)).toBe(true);
  });

  it('keeps the scored point lines consistent with the set scores', () => {
    for (const [setNo, expected] of [
      [1, '*p25:20'],
      [3, '*p25:22'],
    ] as const) {
      const points = file.scout.filter((l) => l.set === setNo && /^[*a]p\d+:\d+$/.test(l.raw));
      expect(points[points.length - 1].raw).toBe(expected);
    }
  });

  it('has no warnings', () => {
    expect(file.warnings).toEqual([]);
  });
});

describe('parseDvw: five-sets-away', () => {
  const file = parsed('five-sets-away.dvw');

  it('reads five sets with a 15-13 decider won by the visiting team', () => {
    expect(file.teams['*'].name).toBe('Rivali Due');
    expect(file.teams.a).toEqual({ name: 'Volley Club Test', setsWon: 3 });
    expect(file.sets.map((s) => [s.home, s.visiting])).toEqual([
      [21, 25],
      [25, 14],
      [18, 25],
      [25, 16],
      [13, 15],
    ]);
    expect(file.sets.every((s) => s.played)).toBe(true);
    expect(new Set(file.scout.map((l) => l.set))).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it('has no warnings', () => {
    expect(file.warnings).toEqual([]);
  });
});

describe('parseDvw: errors and edge cases', () => {
  const three = loadFixture('three-sets-home.dvw');

  it.each([
    ['0', 'indoor sideout'],
    ['2', 'beach rally point'],
    ['', 'missing'],
  ])('refuses regulation %j (%s)', (code) => {
    const text = three.replace(';1252;1;', `;1252;${code};`);
    expect(parseDvw(text)).toEqual({
      error: { code: 'unsupportedRegulation' },
    });
  });

  it('reads space-padded set scores', () => {
    const result = parseDvw(three.replace('6-8;16-11;21-20;25-20;', '6-8;16-11;21-20; 25 - 9 ;'));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.sets[0]).toEqual({ played: true, home: 25, visiting: 9 });
  });

  it('returns an error without [3SCOUT]', () => {
    const text = three.slice(0, three.indexOf('[3SCOUT]'));
    expect(parseDvw(text)).toEqual({ error: { code: 'noRallies' } });
  });

  it('returns null for an unparseable date', () => {
    const result = parseDvw(three.replace('10/18/2026', 'soon'));
    expect(result).toMatchObject({ date: null });
  });

  it('reads Windows line endings the same way', () => {
    const lf = parseDvw(three);
    const crlf = parseDvw(three.replace(/\n/g, '\r\n'));
    expect(crlf).toEqual(lf);
  });

  it('uses an empty generator when the line is missing', () => {
    const result = parseDvw(three.replace(/GENERATOR-PRG:.*\r?\n/, ''));
    expect(result).toMatchObject({ generator: '' });
  });

  it('defaults an invalid role code to 6 and warns about a player without a jersey', () => {
    const text = three
      .replace('T001;Adair;Corin;;;2;', 'T001;Adair;Corin;;;9;')
      .replace('2;3;;3;3;3;;;T002', '2;;;3;3;3;;;T002');
    const result = parseDvw(text);
    if ('error' in result) throw new Error(result.error.code);
    expect(result.players.find((p) => p.fileId === 'T001')?.roleCode).toBe(6);
    expect(result.players.find((p) => p.fileId === 'T002')).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
  });

  it('counts a set marked True but without a final score as not played (DataVolley marks unplayed sets True)', () => {
    const result = parseDvw(three.replace('False;;;;;0;', 'True;;;;;;'));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.sets.filter((s) => s.played)).toHaveLength(3);
    expect(result.sets[3]).toEqual({ played: false, home: 0, visiting: 0 });
  });
});

describe('parseDvw: set numbers come from the set markers', () => {
  const COURTS = '7;11;3;5;8;9;10;6;9;12;7;11';
  const line = (code: string, set: string) => `${code};;;;;;;;${set};1;1;;;;${COURTS}`;
  const fileWith = (lines: string[]) =>
    ['[3MATCH]', '10/18/2026;;;;;;;;1252;1;', '[3SCOUT]', ...lines].join('\n');

  it('counts **Nset markers and warns once per set whose field 9 disagrees or is empty', () => {
    const result = parseDvw(
      fileWith([
        line('*P11>LUp', '1'), // line 4
        line('*07SM#', '1'),
        line('*p01:00', '1'),
        line('**1set', '1'),
        line('*P11>LUp', ''), // line 8: empty
        line('*07SM#', '1'), // line 9: wrong
        line('*p01:00', '2'),
        line('**2set', '2'),
        line('*P11>LUp', '3'),
        line('**3set', '3'),
      ]),
    );
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.set)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3]);
    expect(result.warnings).toEqual([
      { code: 'setNumberMismatch', set: 2, lines: [8, 9] },
    ]);
  });

  it('keeps lines before the first marker in set 1 and lists at most five lines', () => {
    const result = parseDvw(fileWith([...Array.from({ length: 7 }, () => line('*T', '4')), line('**1set', '1')]));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.every((l) => l.set === 1)).toBe(true);
    expect(result.warnings).toEqual([
      { code: 'setNumberMismatch', set: 1, lines: [4, 5, 6, 7, 8, 9, 10] },
    ]);
  });

  it('does not cross-check marker lines: DataVolley writes the next set number on them', () => {
    const result = parseDvw(
      fileWith([line('*07SM#', '1'), line('*p01:00', '1'), line('**1set', '2'), line('*07SM#', '2'), line('**2set', '3')]),
    );
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.set)).toEqual([1, 1, 1, 2, 2]);
    expect(result.warnings).toEqual([]);
  });

  it('skips blank lines, including a stray NUL at the end of the file', () => {
    const result = parseDvw(fileWith([line('*07SM#', '1'), line('*p01:00', '1'), line('**1set', '2'), ' ', String.fromCharCode(0)]));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.raw)).toEqual(['*07SM#', '*p01:00', '**1set']);
  });

  it('keeps rally-less lines after the last marker in the last set (no phantom set)', () => {
    const empty = '*P11>LUp;;;;;;;;4;1;1;;;;;;;;;;;;;;;';
    const result = parseDvw(fileWith([line('*07SM#', '1'), line('*p01:00', '1'), line('**1set', '2'), empty, line('*T', '2')]));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.set)).toEqual([1, 1, 1, 1, 1]);
    expect(result.warnings).toEqual([]);
  });

  it('keeps every line in set 1 when the file has no set markers', () => {
    const result = parseDvw(fileWith([line('*07SM#', '1'), line('*p01:00', '1'), line('*T', '1')]));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.set)).toEqual([1, 1, 1]);
    expect(result.warnings).toEqual([]);
  });

  it('refuses a scout section holding only NUL padding', () => {
    expect(parseDvw(fileWith([String.fromCharCode(0), ' ']))).toEqual({ error: { code: 'noRallies' } });
  });

  it('still starts a set after the last marker when it has rallies (a file saved mid-set)', () => {
    const result = parseDvw(fileWith([line('*07SM#', '1'), line('*p01:00', '1'), line('**1set', '2'), line('*07SM#', '2')]));
    if ('error' in result) throw new Error(result.error.code);
    expect(result.scout.map((l) => l.set)).toEqual([1, 1, 1, 2]);
  });
});
