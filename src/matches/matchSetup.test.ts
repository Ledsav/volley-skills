import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchSetupInput, type RosterEntry } from '../types/match';
import type { Player } from '../types/player';
import { buildRoster, defaultLineup, validateSetup } from './matchSetup';

const player = (id: string, number: number, positionCategory: Player['positionCategory'], starting = false) =>
  ({ id, number, fullName: `Player ${id}`, positionCategory, starting }) as Player;

const roster = (n: number): RosterEntry[] =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, number: i + 1, name: `P${i}`, positionCategory: 'OH' }));

const input = (over: Partial<MatchSetupInput> = {}): MatchSetupInput => ({
  date: '2026-10-18', opponent: 'Rivals', competition: 'league', homeAway: 'home',
  format: DEFAULT_FORMAT, roster: roster(7), liberos: [], ...over,
});

describe('matchSetup', () => {
  it('builds the roster from checked players, starters first, with overridden numbers', () => {
    const players = [player('a', 4, 'OH'), player('b', 2, 'S', true), player('c', 9, 'MB')];
    const picks = { a: { checked: true, number: 14 }, b: { checked: true, number: 2 }, c: { checked: false, number: 9 } };
    expect(buildRoster(players, picks)).toEqual([
      { playerId: 'b', number: 2, name: 'Player b', positionCategory: 'S' },
      { playerId: 'a', number: 14, name: 'Player a', positionCategory: 'OH' },
    ]);
  });

  it('validates required fields and roster size', () => {
    expect(validateSetup(input())).toBeNull();
    expect(validateSetup(input({ opponent: ' ' }))).toMatch(/opponent/i);
    expect(validateSetup(input({ date: '' }))).toMatch(/date/i);
    expect(validateSetup(input({ roster: roster(5) }))).toMatch(/at least 6/i);
    expect(validateSetup(input({ roster: roster(7), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toBeNull();
    expect(validateSetup(input({ roster: roster(6), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toMatch(/at least 6/i);
    expect(validateSetup(input({ liberos: [{ playerId: 'ghost', mode: 'always', replaces: [] }] }))).toMatch(/libero/i);
    const dup = roster(7);
    dup[1] = { ...dup[1], number: 1 };
    expect(validateSetup(input({ roster: dup }))).toMatch(/#1/);
  });

  it('defaults the lineup to the first six non-libero players', () => {
    expect(defaultLineup(roster(8), [{ playerId: 'p0', mode: 'always', replaces: [] }])).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });
});
