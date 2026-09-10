import { describe, expect, it } from 'vitest';
import { filterRoster, positionRank, sortRoster } from './rosterSort';
import type { Player, PositionCategory } from '../types/player';

function player(overrides: Partial<Player>): Player {
  return {
    id: overrides.id ?? 'p',
    number: 0,
    fullName: '',
    positionCategory: 'TBD',
    starting: false,
    avgScore: null,
    ...overrides,
  } as Player;
}

describe('positionRank', () => {
  it('orders setters, then OH, opposite, MB, libero, TBD, and universal last', () => {
    const order: PositionCategory[] = ['S', 'OH', 'O', 'MB', 'L', 'TBD', 'U'];
    const ranks = order.map(positionRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(order.length);
  });

  it('sorts an all-round (universal) player below an unassigned one', () => {
    expect(positionRank('U')).toBeGreaterThan(positionRank('TBD'));
  });

  it('treats a missing category as TBD', () => {
    expect(positionRank(null)).toBe(positionRank('TBD'));
    expect(positionRank(undefined)).toBe(positionRank('TBD'));
  });
});

describe('filterRoster', () => {
  const roster = [
    player({ id: 'a', number: 4, fullName: 'Ana Silva', positionCategory: 'S' }),
    player({ id: 'b', number: 12, fullName: 'Bea Costa', positionCategory: 'MB' }),
  ];

  it('returns every player when the search is blank', () => {
    expect(filterRoster(roster, '   ')).toEqual(roster);
  });

  it('matches the full name case-insensitively', () => {
    expect(filterRoster(roster, 'ana').map((p) => p.id)).toEqual(['a']);
  });

  it('matches the position-category code', () => {
    expect(filterRoster(roster, 'MB').map((p) => p.id)).toEqual(['b']);
  });

  it('matches the shirt number', () => {
    expect(filterRoster(roster, '12').map((p) => p.id)).toEqual(['b']);
  });
});

describe('sortRoster', () => {
  it('orders by shirt number ascending', () => {
    const roster = [player({ id: 'x', number: 9 }), player({ id: 'y', number: 2 })];
    expect(sortRoster(roster, 'number').map((p) => p.id)).toEqual(['y', 'x']);
  });

  it('orders by skill average high to low, players without a score last', () => {
    const roster = [
      player({ id: 'low', number: 1, avgScore: 4.2 }),
      player({ id: 'none', number: 2, avgScore: null }),
      player({ id: 'high', number: 3, avgScore: 8.1 }),
    ];
    expect(sortRoster(roster, 'skill').map((p) => p.id)).toEqual(['high', 'low', 'none']);
  });

  it('breaks a skill tie by shirt number', () => {
    const roster = [
      player({ id: 'b', number: 7, avgScore: 6 }),
      player({ id: 'a', number: 3, avgScore: 6 }),
    ];
    expect(sortRoster(roster, 'skill').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('for the lineup, puts starters first, then orders by position, then by number', () => {
    const roster = [
      player({ id: 'sub-setter', number: 5, positionCategory: 'S', starting: false }),
      player({ id: 'start-mb', number: 8, positionCategory: 'MB', starting: true }),
      player({ id: 'start-setter', number: 3, positionCategory: 'S', starting: true }),
      player({ id: 'start-oh-b', number: 11, positionCategory: 'OH', starting: true }),
      player({ id: 'start-oh-a', number: 6, positionCategory: 'OH', starting: true }),
    ];
    expect(sortRoster(roster, 'lineup').map((p) => p.id)).toEqual([
      'start-setter',
      'start-oh-a',
      'start-oh-b',
      'start-mb',
      'sub-setter',
    ]);
  });

  it('does not mutate the input array', () => {
    const roster = [player({ id: 'x', number: 9 }), player({ id: 'y', number: 2 })];
    sortRoster(roster, 'number');
    expect(roster.map((p) => p.id)).toEqual(['x', 'y']);
  });
});
