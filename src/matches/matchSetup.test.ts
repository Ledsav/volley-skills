import { describe, expect, it } from 'vitest';
import { DEFAULT_FORMAT, type MatchSetupInput, type RosterEntry } from '../types/match';
import type { Player } from '../types/player';
import { buildRoster, defaultLineup, defaultRosterIds, validateSetup } from './matchSetup';

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
    expect(validateSetup(input({ opponent: ' ' }))).toEqual({ code: 'noOpponent' });
    expect(validateSetup(input({ date: '' }))).toEqual({ code: 'noDate' });
    expect(validateSetup(input({ roster: roster(5) }))).toEqual({ code: 'tooFewPlayers' });
    expect(validateSetup(input({ roster: roster(7), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toBeNull();
    expect(validateSetup(input({ roster: roster(6), liberos: [{ playerId: 'p0', mode: 'always', replaces: [] }] }))).toEqual({ code: 'tooFewPlayers' });
    expect(validateSetup(input({ liberos: [{ playerId: 'ghost', mode: 'always', replaces: [] }] }))).toEqual({ code: 'liberoNotInRoster' });
    const dup = roster(7);
    dup[1] = { ...dup[1], number: 1 };
    expect(validateSetup(input({ roster: dup }))).toEqual({ code: 'duplicateNumber', number: 1 });
  });

  it('rejects the same player in both libero slots', () => {
    const lib = { playerId: 'p0', mode: 'always' as const, replaces: [] };
    expect(validateSetup(input({ roster: roster(8), liberos: [lib, { ...lib, mode: 'receiving' }] }))).toEqual({ code: 'liberoTwice' });
  });

  it('rejects jersey numbers that are not positive integers', () => {
    for (const bad of [0, -3, 2.5, Number.NaN]) {
      const r = roster(7);
      r[2] = { ...r[2], number: bad };
      expect(validateSetup(input({ roster: r }))).toMatchObject({ code: 'badNumber' });
    }
  });

  it('rejects a roster of more than 14 players and numbers above 99', () => {
    expect(validateSetup(input({ roster: roster(14) }))).toBeNull();
    expect(validateSetup(input({ roster: roster(15) }))).toEqual({ code: 'rosterTooLarge', max: 14 });
    const r = roster(7);
    r[3] = { ...r[3], number: 100 };
    expect(validateSetup(input({ roster: r }))).toMatchObject({ code: 'badNumber' });
  });

  it('defaults ticks to 14: starters first, then liberos, then by number', () => {
    const many = Array.from({ length: 17 }, (_, i) => player(`p${i}`, i + 1, 'OH', i === 16));
    many[15] = player('lib', 40, 'L');
    const ids = defaultRosterIds(many);
    expect(ids).toHaveLength(14);
    expect(ids[0]).toBe('p16');
    expect(ids).toContain('lib');
    expect(ids).not.toContain('p14');
  });

  it('defaults the lineup to the first six non-libero players', () => {
    expect(defaultLineup(roster(8), [{ playerId: 'p0', mode: 'always', replaces: [] }])).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });
});
