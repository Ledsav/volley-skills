import { describe, expect, it } from 'vitest';
import { barFraction, leaderBand } from './leaderBars';

describe('leaderBars', () => {
  it('barFraction scales to the leader', () => {
    expect(barFraction(30, 40)).toBe(0.75);
    expect(barFraction(40, 40)).toBe(1);
  });

  it('barFraction is 0 when the leader is not positive', () => {
    expect(barFraction(-0.1, -0.05)).toBe(0);
    expect(barFraction(0, 0)).toBe(0);
  });

  it("leaderBand uses the season rating of the award's skill", () => {
    expect(leaderBand('attacker', { attack: { rating: 7.2, attempts: 40 } })).toBe('Advanced');
    expect(leaderBand('topScorer', { attack: { rating: 7.2, attempts: 40 } })).toBeNull();
    expect(leaderBand('server', { serve: { rating: null, attempts: 3 } })).toBeNull();
  });
});
