import { describe, expect, it } from 'vitest';
import { finished } from '../../awards/testMatches';
import type { TeamPlayerRow } from './teamSeason';
import { teamStatsCsv, teamStatsCsvFileName } from './teamStatsCsv';

const row = (over: Partial<TeamPlayerRow>): TeamPlayerRow => ({
  playerId: 'a', number: 7, name: 'Ana', current: true, matchesPlayed: 3, points: 12, errors: 4, mvpAvg: 3.25,
  attackEff: 0.4125, serveEff: null, receptionPos: 0.5, ratings: { attack: { rating: 7.25, attempts: 40 } }, ...over,
});

describe('teamStatsCsv', () => {
  it('writes BOM, header and EU decimals', () => {
    const csv = teamStatsCsv([row({})], 'eu');
    expect(csv.startsWith('﻿Number;Name;Matches;Points;Errors;MVP avg;Attack eff;Serve eff;Reception +')).toBe(true);
    expect(csv).toContain('7;Ana;3;12;4;3,25;0,413;;0,5');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('guards formula injection in names', () => {
    expect(teamStatsCsv([row({ name: '=HYPERLINK("x")' })], 'en')).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('file name from team and date span', () => {
    const ms = [finished('a', '2026-09-01', []), finished('b', '2026-10-12', [])];
    expect(teamStatsCsvFileName('U17 Girls', ms)).toBe('U17-Girls-stats-2026-09-01-2026-10-12.csv');
  });
});
