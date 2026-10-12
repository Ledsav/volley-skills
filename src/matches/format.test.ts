import { describe, expect, it } from 'vitest';
import type { MatchEvent, RosterEntry } from '../types/match';
import { describeEvent, fmtEff, fmtPct, rosterMap } from './format';

const roster: RosterEntry[] = [
  { playerId: 'p7', number: 7, name: 'Ana', positionCategory: 'OH' },
  { playerId: 'p9', number: 9, name: 'Lucía', positionCategory: 'OH' },
];
const meta = { id: 'e', order: 1, source: 'tap' as const, chunkId: null };

describe('format', () => {
  it('formats percentages and efficiencies', () => {
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(0.526)).toBe('53%');
    expect(fmtEff(0.25)).toBe('+25%');
    expect(fmtEff(-0.1)).toBe('-10%');
  });

  it('describes events for the timeline', () => {
    const map = rosterMap(roster);
    const ev = (e: object) => ({ ...meta, ...e }) as MatchEvent;
    expect(describeEvent(ev({ type: 'action', playerId: 'p7', skill: 'A', grade: '#' }), map)).toBe('#7 Attack # Kill');
    expect(describeEvent(ev({ type: 'point', winner: 'them', reason: 'oppKill' }), map)).toBe('Point them · Opp. kill');
    expect(describeEvent(ev({ type: 'sub', outPlayerId: 'p7', inPlayerId: 'p9' }), map)).toBe('Sub #9 in for #7');
    expect(describeEvent(ev({ type: 'timeout', team: 'us' }), map)).toBe('Timeout us');
    expect(describeEvent(ev({ type: 'setStart', set: 2, lineup: [], serving: 'them' }), map)).toBe('Set 2 · they serve');
    expect(describeEvent(ev({ type: 'correction', score: { us: 3, them: 4 }, rotation: null, serving: null }), map))
      .toBe('Correction · score 3–4');
  });
});
