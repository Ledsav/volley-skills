import { describe, expect, it } from 'vitest';
import type { GradeCounts, Match, PlayerStats, SkillLine } from '../types/match';
import { matchRatings, seasonStats, suggestedScore } from './matchRating';

const line = (grades: Partial<GradeCounts>): SkillLine => {
  const g: GradeCounts = { '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0, ...grades };
  return { attempts: Object.values(g).reduce((a, b) => a + b, 0), grades: g };
};

const stats = (skills: PlayerStats['skills'], extra: Partial<PlayerStats> = {}): PlayerStats => ({
  playerId: 'p1', skills, points: 0, errors: 0, attackEff: null, serveEff: null, receptionPos: null, receptionPerfect: null, ...extra,
});

const matchWith = (id: string, date: string, players: Record<string, PlayerStats> | null): Match =>
  ({
    id, date, opponent: `Opp ${id}`,
    summary: players ? { players, team: {}, timeoutEffects: [], sourceCounts: { tap: 0, text: 0 } } : null,
  }) as unknown as Match;

describe('seasonStats', () => {
  it('sums grade counts across matches and recomputes efficiency from the totals', () => {
    const season = seasonStats(
      [
        matchWith('m1', '2026-10-01', { p1: stats({ A: line({ '#': 3, '=': 1 }) }, { attackEff: 0.5, points: 3, errors: 1 }) }),
        matchWith('m2', '2026-10-08', { p1: stats({ A: line({ '#': 1, '-': 5 }) }, { attackEff: 1 / 6, points: 1 }) }),
      ],
      'p1',
    );
    expect(season.skills.A).toEqual(line({ '#': 4, '=': 1, '-': 5 }));
    expect(season.attackEff).toBeCloseTo(0.3); // (4 - 1) / 10, not the mean of 0.5 and 0.167
    expect(season.points).toBe(4);
    expect(season.errors).toBe(1);
    expect(season.matchesPlayed).toBe(2);
  });

  it('skips matches without a summary, without the player, or where the player has no actions', () => {
    const season = seasonStats(
      [
        matchWith('old', '2026-09-01', null),
        matchWith('absent', '2026-09-08', { other: stats({ S: line({ '#': 1 }) }) }),
        matchWith('quick', '2026-09-15', { p1: stats({}) }),
        matchWith('m1', '2026-09-22', { p1: stats({ R: line({ '#': 1, '+': 1, '-': 2 }) }) }),
      ],
      'p1',
    );
    expect(season.matchesPlayed).toBe(1);
    expect(season.rows.map((r) => r.matchId)).toEqual(['m1']);
    expect(season.receptionPos).toBe(0.5);
    expect(season.receptionPerfect).toBe(0.25);
  });

  it('lists per-match rows newest first', () => {
    const season = seasonStats(
      [
        matchWith('a', '2026-10-01', { p1: stats({ S: line({ '#': 1 }) }, { serveEff: 1 }) }),
        matchWith('b', '2026-10-15', { p1: stats({ S: line({ '=': 1 }) }, { serveEff: -1 }) }),
      ],
      'p1',
    );
    expect(season.rows).toEqual([
      { matchId: 'b', date: '2026-10-15', opponent: 'Opp b', attackEff: null, serveEff: -1, receptionPos: null, points: 0, errors: 0 },
      { matchId: 'a', date: '2026-10-01', opponent: 'Opp a', attackEff: null, serveEff: 1, receptionPos: null, points: 0, errors: 0 },
    ]);
  });

  it('returns an empty season for no matches', () => {
    const season = seasonStats([], 'p1');
    expect(season.matchesPlayed).toBe(0);
    expect(season.attackEff).toBeNull();
    expect(season.rows).toEqual([]);
  });
});

describe('matchRatings', () => {
  const ratingsFor = (skills: PlayerStats['skills']) =>
    matchRatings(seasonStats([matchWith('m', '2026-10-01', { p1: stats(skills) })], 'p1'));

  it('maps grade quality onto 1–10', () => {
    expect(ratingsFor({ S: line({ '#': 15 }) }).serve).toEqual({ rating: 10, attempts: 15 });
    expect(ratingsFor({ S: line({ '=': 15 }) }).serve).toEqual({ rating: 1, attempts: 15 });
    expect(ratingsFor({ R: line({ '!': 20 }) }).reception).toEqual({ rating: 5.5, attempts: 20 });
  });

  it('withholds a rating below the minimum but reports the attempts', () => {
    expect(ratingsFor({ A: line({ '#': 14 }) }).attack).toEqual({ rating: null, attempts: 14 });
  });

  it('merges dig and free ball into defence', () => {
    expect(ratingsFor({ D: line({ '+': 10 }), F: line({ '+': 5 }) }).defence).toEqual({ rating: 7.75, attempts: 15 });
  });

  it('maps set and block, and leaves skills without data or without a scouted source out', () => {
    const r = ratingsFor({ E: line({ '#': 15 }), B: line({ '-': 16 }) });
    expect(r.set?.rating).toBe(10);
    expect(r.block?.rating).toBe(3.25);
    expect(Object.keys(r).sort()).toEqual(['block', 'set']);
  });
});

describe('suggestedScore', () => {
  it('rounds and clamps to the 1–10 scale', () => {
    expect(suggestedScore(7.75)).toBe(8);
    expect(suggestedScore(7.4)).toBe(7);
    expect(suggestedScore(0.2)).toBe(1);
    expect(suggestedScore(10.4)).toBe(10);
  });
});
