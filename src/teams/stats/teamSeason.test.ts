import { describe, expect, it } from 'vitest';
import { finished, player } from '../../awards/testMatches';
import { latestRosterIndex } from './rosterIndex';
import { DEFAULT_FILTER, filterMatches, seasonCoverage, teamSeason } from './teamSeason';

const ms = [
  finished('m1', '2026-09-01', [player('a', { A: '##=', R: '#+' })], { competition: 'league', homeAway: 'home' }),
  finished('m2', '2026-09-08', [player('a', { A: '#' }), player('b', { S: '#' })], { competition: 'cup', homeAway: 'away', result: { setsUs: 1, setsThem: 3, sets: [] } }),
  finished('m3', '2026-09-15', [], {}),
  finished('m4', '2026-09-22', null, {}),
];

describe('teamSeason', () => {
  it('coverage counts scouted, score-only and skipped', () => {
    expect(seasonCoverage(ms)).toEqual({ scouted: 2, scoreOnly: 1, skipped: 1, capped: false });
  });

  it('flags the cap at 60 docs', () => {
    const many = Array.from({ length: 60 }, (_, i) => finished(`x${i}`, '2026-09-01', null));
    expect(seasonCoverage(many).capped).toBe(true);
  });

  it('filters by competition, home/away, last N and dates', () => {
    expect(filterMatches(ms, { ...DEFAULT_FILTER, competition: 'cup' }).map((m) => m.id)).toEqual(['m2']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, homeAway: 'home' }).map((m) => m.id)).toEqual(['m1', 'm3', 'm4']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, range: { kind: 'last', count: 5 } }).map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(filterMatches(ms, { ...DEFAULT_FILTER, range: { kind: 'dates', from: '2026-09-05', to: '2026-09-20' } }).map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('dates range is open-ended when a bound is empty, and swaps a reversed range', () => {
    const ids = (from: string, to: string) => filterMatches(ms, { ...DEFAULT_FILTER, range: { kind: 'dates', from, to } }).map((m) => m.id);
    expect(ids('', '2026-09-08')).toEqual(['m1', 'm2']);
    expect(ids('2026-09-08', '')).toEqual(['m2', 'm3', 'm4']);
    expect(ids('', '')).toEqual(['m1', 'm2', 'm3', 'm4']);
    expect(ids('2026-09-20', '2026-09-05')).toEqual(ids('2026-09-05', '2026-09-20'));
  });

  it('aggregates record, side-out from summed totals and rotations', () => {
    const s = teamSeason(ms, latestRosterIndex(ms));
    expect(s.record).toEqual({ won: 3, lost: 1, setsWon: 10, setsLost: 6 });
    expect(s.sideOut).toBeCloseTo(0.5); // 10/20 per scouted summary, summed
    expect(s.rotations[4]).toEqual({ won: 15, lost: 3 }); // m1, m2, m3 summaries x (5,1)
    expect(s.bestRotation).toBe(4);
    expect(s.weakestRotation).toBe(5);
    expect(s.trend.map((t) => t.matchId)).toEqual(['m1', 'm2', 'm3']);
  });

  it('player rows from summed counts, newest roster names', () => {
    const s = teamSeason(ms, latestRosterIndex(ms));
    const a = s.players.find((p) => p.playerId === 'a')!;
    expect(a.matchesPlayed).toBe(2);
    expect(a.attackEff).toBeCloseTo((3 - 1) / 4);
    expect(a.name).toBe('Player a');
  });

  it('empty input gives nulls, not NaN', () => {
    const s = teamSeason([], new Map());
    expect(s.sideOut).toBeNull();
    expect(s.attackEff).toBeNull();
    expect(s.bestRotation).toBeNull();
    expect(s.players).toEqual([]);
  });
});
