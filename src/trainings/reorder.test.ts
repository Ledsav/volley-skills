import { describe, expect, it } from 'vitest';
import { dropIndex, moveRow } from './reorder';

describe('reorder', () => {
  it('moveRow moves one item and keeps the rest in order', () => {
    expect(moveRow(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveRow(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('dropIndex counts the other midpoints above the pointer', () => {
    const mids = [10, 30, 50, 70];
    expect(dropIndex(mids, 0, 35)).toBe(1);
    expect(dropIndex(mids, 0, 75)).toBe(3);
    expect(dropIndex(mids, 3, 5)).toBe(0);
    expect(dropIndex(mids, 2, 50)).toBe(2);
  });
});
