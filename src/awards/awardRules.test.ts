import { describe, expect, it } from 'vitest';
import { AWARDS_FOR, mvpAverage, mvpScore, quality, rankAward, scoutedMatches } from './awardRules';
import { finished, line, player } from './testMatches';

const A8 = (s: string) => s.padEnd(8, '!'); // pad to the match minimum with neutral grades

describe('awardRules', () => {
  it('lists awards per scope with MVP last', () => {
    expect(AWARDS_FOR.match).toEqual(['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter', 'mvp']);
    expect(AWARDS_FOR.season).toEqual(['topScorer', 'attacker', 'server', 'receiver', 'blocker', 'defender', 'setter', 'mostImproved', 'everPresent', 'mvp']);
  });

  it('quality uses grade weights', () => {
    expect(quality(line('####'))).toBe(1);
    expect(quality(line('===='))).toBe(0);
    expect(quality(line('#='))).toBe(0.5);
    expect(quality(undefined)).toBeNull();
  });

  it('mvpScore = points - errors + 0.5 x sum attempts x (quality - 0.5)', () => {
    // A: "##=" -> points 2, errors 1, quality 2/3 -> 3 x (1/6) = 0.5 -> x 0.5 = 0.25
    expect(mvpScore(player('p', { A: '##=' }))).toBeCloseTo(2 - 1 + 0.25);
    // R: "####" -> 0 points, quality 1 -> 4 x 0.5 x 0.5 = 1
    expect(mvpScore(player('p', { R: '####' }))).toBeCloseTo(1);
  });

  it('scoutedMatches skips null summaries and score-only matches', () => {
    const ms = [finished('a', '2026-10-01', null), finished('b', '2026-10-02', []), finished('c', '2026-10-03', [player('p', { S: '#' })])];
    expect(scoutedMatches(ms).map((m) => m.id)).toEqual(['c']);
  });

  it('match MVP ranks by score with tie-break fewer errors', () => {
    const m = finished('m', '2026-10-01', [player('a', { A: '##=' }), player('b', { A: '###' }), player('c', { R: '+' })]);
    const r = rankAward('mvp', 'match', [m]);
    expect(r.ranked[0].playerId).toBe('b');
    expect(r.ranked.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it('attacker needs 8 attempts in a match; below goes to notEnoughData', () => {
    const m = finished('m', '2026-10-01', [player('a', { A: A8('####') }), player('b', { A: '###' })]);
    const r = rankAward('attacker', 'match', [m]);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']);
    expect(r.ranked[0].attempts).toBe(8);
    expect(r.ranked[0].display).toBe('+50% att. eff.');
    expect(r.notEnoughData).toEqual(['b']);
  });

  it('season attacker needs 30 attempts', () => {
    const ms = [1, 2, 3].map((i) => finished(`m${i}`, `2026-10-0${i}`, [player('a', { A: '#'.repeat(10) })]));
    expect(rankAward('attacker', 'season', ms).ranked.map((x) => x.playerId)).toEqual(['a']);
    expect(rankAward('attacker', 'season', ms.slice(0, 2)).notEnoughData).toEqual(['a']);
  });

  it('server tie-break: more aces', () => {
    // both serveEff 0: a has "#=" x4 (4 aces), b has "!!" x4 (0 aces)
    const m = finished('m', '2026-10-01', [player('b', { S: '!!!!!!!!' }), player('a', { S: '#=#=#=#=' })]);
    expect(rankAward('server', 'match', [m]).ranked.map((x) => x.playerId)).toEqual(['a', 'b']);
  });

  it('full ties share a rank and both are kept', () => {
    const m = finished('m', '2026-10-01', [player('a', { B: '#' }), player('b', { B: '#' }), player('c', { B: '##' })]);
    const r = rankAward('blocker', 'match', [m]);
    expect(r.ranked.map((x) => [x.playerId, x.rank])).toEqual([['c', 1], ['a', 2], ['b', 2]]);
  });

  it('season MVP is the per-match average and needs >= 50% of scouted matches', () => {
    const ms = [
      finished('m1', '2026-10-01', [player('a', { A: '#' }), player('b', { A: '###' })]),
      finished('m2', '2026-10-02', [player('a', { A: '###' })]),
      finished('m3', '2026-10-03', [player('a', { A: '#' })]),
    ];
    expect(mvpAverage(ms, 'b')).not.toBeNull();
    const r = rankAward('mvp', 'season', ms);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']); // b played 1 of 3 < 50%
    expect(r.notEnoughData).toEqual(['b']);
  });

  it('most improved: last third vs first third, >= 6 matches, positive only', () => {
    const grades = ['=', '=', '#', '#', '###', '###'];
    const ms = grades.map((g, i) => finished(`m${i}`, `2026-10-0${i + 1}`, [player('a', { A: g }), player('b', { A: '#' })]));
    const r = rankAward('mostImproved', 'season', ms);
    expect(r.ranked.map((x) => x.playerId)).toEqual(['a']); // b flat -> not ranked
    expect(rankAward('mostImproved', 'season', ms.slice(0, 5)).ranked).toEqual([]);
    expect(rankAward('mostImproved', 'match', ms).ranked).toEqual([]);
  });

  it('ever-present counts matches played, tie-break more actions', () => {
    const ms = [
      finished('m1', '2026-10-01', [player('a', { S: '!' }), player('b', { S: '!!' })]),
      finished('m2', '2026-10-02', [player('a', { S: '!' }), player('b', { S: '!' })]),
    ];
    expect(rankAward('everPresent', 'season', ms).ranked.map((x) => x.playerId)).toEqual(['b', 'a']);
  });

  it('returns empty rankings when nothing is scouted', () => {
    const ms = [finished('a', '2026-10-01', null), finished('b', '2026-10-02', [])];
    for (const id of AWARDS_FOR.season) expect(rankAward(id, 'season', ms).ranked).toEqual([]);
  });
});
