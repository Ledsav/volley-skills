import { describe, expect, it } from 'vitest';
import { applyUsage, computeUsageContribution } from './usage';

describe('usage', () => {
  it('counts actions per player and skill', () => {
    const actions = [
      { eventId: '1', set: 1, playerId: 'p', skill: 'A' as const, grade: '#' as const, source: 'tap' as const },
      { eventId: '2', set: 2, playerId: 'p', skill: 'A' as const, grade: '+' as const, source: 'tap' as const },
      { eventId: '3', set: 1, playerId: 'q', skill: 'E' as const, grade: '+' as const, source: 'tap' as const },
    ];
    expect(computeUsageContribution({ actions })).toEqual({ p: { A: 2 }, q: { E: 1 } });
  });

  it('adds a first contribution', () => {
    const profile = applyUsage({ players: {} }, null, { p: { A: 2 } });
    expect(profile).toEqual({ players: { p: { matches: 1, totals: { A: 2 } } } });
  });

  it('replaces a previous contribution instead of double counting on re-finish', () => {
    const once = applyUsage({ players: { p: { matches: 3, totals: { A: 10 } } } }, null, { p: { A: 2 } });
    const again = applyUsage(once, { p: { A: 2 } }, { p: { A: 5 }, q: { R: 1 } });
    expect(again.players.p).toEqual({ matches: 4, totals: { A: 15 } });
    expect(again.players.q).toEqual({ matches: 1, totals: { R: 1 } });
  });

  it('removes a player whose only match contribution is withdrawn', () => {
    const once = applyUsage({ players: {} }, null, { p: { A: 2 } });
    expect(applyUsage(once, { p: { A: 2 } }, {}).players.p).toBeUndefined();
  });
});
