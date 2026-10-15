// src/awards/story/storyStats.test.ts
import { describe, expect, it } from 'vitest';
import { finished, player } from '../testMatches';
import { latestRosterIndex } from '../../teams/stats/rosterIndex';
import { storyStats } from './storyStats';

const run = (scope: 'season' | 'match', ms: ReturnType<typeof finished>[]) => storyStats(scope, ms, latestRosterIndex(ms));

describe('storyStats', () => {
  it('nothing for no matches', () => {
    expect(run('season', [])).toEqual([]);
  });

  it('season record counts wins out of matches with set totals', () => {
    const ms = [finished('a', '2026-09-01', null), finished('b', '2026-09-08', null, { result: { setsUs: 1, setsThem: 3, sets: [] } })];
    const [record] = run('season', ms);
    expect(record).toMatchObject({ id: 'record', big: 1, caption: 'win out of 2 matches', detail: 'Sets 4–4' });
  });

  it('skips the record slide for a winless season', () => {
    const ms = [finished('a', '2026-09-01', null, { result: { setsUs: 0, setsThem: 3, sets: [] } })];
    expect(run('season', ms).some((s) => s.id === 'record')).toBe(false);
  });

  it('score-only season: record shown, strength and rotation skipped, no NaN', () => {
    const ms = [finished('a', '2026-09-01', null), finished('b', '2026-09-08', null)];
    const stats = run('season', ms);
    expect(stats.map((s) => s.id)).toEqual(['record']);
    for (const s of stats) expect(Number.isFinite(s.big)).toBe(true);
  });

  it('picks reception when it beats side-out by more', () => {
    // fixture side-out is exactly 50% (score 0); reception 100% from '#+'
    const ms = [finished('a', '2026-09-01', [player('p', { R: '#+' })])];
    const strength = run('season', ms).find((s) => s.id === 'strength')!;
    expect(strength).toMatchObject({ kicker: 'Reception', big: 100, bigSuffix: '%' });
  });

  it('falls back to aces when no percentage is positive', () => {
    const ms = [finished('a', '2026-09-01', [player('p', { R: '==' })])];
    const strength = run('season', ms).find((s) => s.id === 'strength')!;
    expect(strength).toMatchObject({ big: 3, caption: 'aces' });
  });

  it('shows the best rotation only with at least 20 rallies', () => {
    const one = [finished('a', '2026-09-01', [player('p', { A: '#' })])];
    expect(run('season', one).some((s) => s.id === 'rotation')).toBe(false);
    const four = ['a', 'b', 'c', 'd'].map((id, i) => finished(id, `2026-09-0${i + 1}`, [player('p', { A: '#' })]));
    expect(run('season', four).find((s) => s.id === 'rotation')).toMatchObject({ kicker: 'Rotation 4', big: 83, detail: '20 of 24 rallies' });
  });

  it('match scope: final score with set scores, no rotation slide', () => {
    const m = finished('a', '2026-09-01', [player('p', { R: '#+' })], { opponent: 'Rivals', result: { setsUs: 3, setsThem: 1, sets: [{ us: 25, them: 20 }, { us: 22, them: 25 }, { us: 25, them: 18 }, { us: 25, them: 23 }] } });
    const stats = run('match', [m]);
    expect(stats[0]).toMatchObject({ id: 'record', kicker: 'Final score', big: 3, bigSuffix: '–1', caption: 'vs Rivals', detail: '25–20 · 22–25 · 25–18 · 25–23' });
    expect(stats.some((s) => s.id === 'rotation')).toBe(false);
  });
});
