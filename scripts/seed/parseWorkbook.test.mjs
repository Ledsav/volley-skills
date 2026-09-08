import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cellScore, cellText, parseDob, parseWorkbook, splitCriteria, SKILL_KEYS } from './parseWorkbook.mjs';

const WORKBOOK = 'reference/VCB_U17_PlayerCards_2026-27.xlsx';

describe('cellText', () => {
  it('flattens strings, numbers, dates, richText and formula results', () => {
    expect(cellText('  hi  ')).toBe('hi');
    expect(cellText(7)).toBe('7');
    expect(cellText(new Date('2012-12-14T00:00:00Z'))).toBe('2012-12-14');
    expect(cellText({ richText: [{ text: 'a' }, { text: 'b' }] })).toBe('ab');
    expect(cellText({ formula: 'A1', result: 5 })).toBe('5');
    expect(cellText(null)).toBe('');
  });
});

describe('cellScore', () => {
  it('accepts 1-10 numbers, rejects everything else', () => {
    expect(cellScore(7)).toBe(7);
    expect(cellScore('9')).toBe(9);
    expect(cellScore(0)).toBeNull();
    expect(cellScore(11)).toBeNull();
    expect(cellScore('')).toBeNull();
    expect(cellScore('n/a')).toBeNull();
  });
});

describe('parseDob', () => {
  it('normalizes D.M.YY / D.M.YYYY / ISO / Date to YYYY-MM-DD', () => {
    expect(parseDob('14.12.12')).toBe('2012-12-14');
    expect(parseDob('4.7.11')).toBe('2011-07-04');
    expect(parseDob('14.12.2012')).toBe('2012-12-14');
    expect(parseDob('2012-12-14')).toBe('2012-12-14');
    expect(parseDob(new Date('2011-02-21T00:00:00Z'))).toBe('2011-02-21');
    expect(parseDob('')).toBe('');
    expect(parseDob('not a date')).toBe('');
  });
});

describe('splitCriteria', () => {
  it('splits a "1-3: … 4-6: … 7-8: … 9-10: …" band string into 4 ranges', () => {
    const ranges = splitCriteria(
      '1-3: Inconsistent, many faults. 4-6: Regular float. 7-8: Tactical serving. 9-10: Jump-serve with pace.'
    );
    expect(ranges).toEqual([
      { min: 1, max: 3, description: 'Inconsistent, many faults.' },
      { min: 4, max: 6, description: 'Regular float.' },
      { min: 7, max: 8, description: 'Tactical serving.' },
      { min: 9, max: 10, description: 'Jump-serve with pace.' },
    ]);
  });

  it('falls back to a single 1-10 range when no band markers are present', () => {
    expect(splitCriteria('just some text')).toEqual([{ min: 1, max: 10, description: 'just some text' }]);
  });

  it('returns [] for an empty cell', () => {
    expect(splitCriteria('')).toEqual([]);
  });
});

describe.skipIf(!existsSync(WORKBOOK))('parseWorkbook (against the real gitignored workbook)', () => {
  it('produces one team, an 8-skill guide, and 20 players in data-model shape', async () => {
    const { team, skillGuide, players } = await parseWorkbook(WORKBOOK);

    expect(team).toMatchObject({ name: 'U17', ageGroup: 'U17', season: '2026-2027' });
    expect(team.club).toMatch(/Belair/);

    expect(skillGuide.map((s) => s.key)).toEqual(SKILL_KEYS);
    for (const entry of skillGuide) {
      expect(entry.ranges).toHaveLength(4);
      expect(entry.ranges.map((r) => [r.min, r.max])).toEqual([
        [1, 3],
        [4, 6],
        [7, 8],
        [9, 10],
      ]);
      expect(entry.howToEvaluate.length).toBeGreaterThan(0);
    }

    expect(players).toHaveLength(20);
    expect(players.map((p) => p.number)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    for (const p of players) {
      expect(p.fullName).not.toBe('');
      expect(p.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(p.skills).sort()).toEqual([...SKILL_KEYS].sort());
      expect(Object.values(p.skills).every((s) => s.score === null)).toBe(true);
      expect(p.developmentPlan).toEqual({ shortTermObjectives: [], seasonObjectives: [], generalNotes: '' });
      for (const g of p.guardians) {
        expect(['mother', 'father']).toContain(g.relation);
      }
    }
  });
});
