import { describe, expect, it } from 'vitest';
import { coveredTargets, needsMorePlayers, sortByFit } from './suggestions';

describe('needsMorePlayers', () => {
  it('is true only when both are set and the drill needs more', () => {
    expect(needsMorePlayers(8, 6)).toBe(true);
    expect(needsMorePlayers(6, 6)).toBe(false);
    expect(needsMorePlayers(undefined, 6)).toBe(false);
    expect(needsMorePlayers(8, null)).toBe(false);
  });
});

describe('sortByFit', () => {
  const items = [{ id: 'a', minPlayers: 8 }, { id: 'b' }, { id: 'c', minPlayers: 4 }];

  it('moves drills needing more players after the ones that fit, keeping order otherwise', () => {
    expect(sortByFit(items, 6).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });

  it('keeps the original order when no suggested players is set', () => {
    expect(sortByFit(items, null).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('coveredTargets', () => {
  it('returns the targets that a selected exercise covers', () => {
    expect(coveredTargets(['service', 'defense'], [{ category: 'service' }, {}])).toEqual(new Set(['service']));
  });
});
