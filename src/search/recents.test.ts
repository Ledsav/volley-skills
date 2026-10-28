import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRecents, pushRecent, readRecents, RECENTS_KEY, type Recent } from './recents';

const rec = (n: number): Recent => ({ id: `t${n}`, group: 'teams', label: `Team ${n}`, to: `/teams/${n}` });

describe('recents', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps the newest 8, deduped by id', () => {
    for (let i = 1; i <= 10; i++) pushRecent(rec(i));
    pushRecent(rec(5));
    const ids = readRecents().map((r) => r.id);
    expect(ids).toHaveLength(8);
    expect(ids[0]).toBe('t5');
    expect(ids.filter((id) => id === 't5')).toHaveLength(1);
    expect(ids).toEqual(['t5', 't10', 't9', 't8', 't7', 't6', 't4', 't3']);
  });

  it('uses sessionStorage, never localStorage', () => {
    pushRecent(rec(1));
    expect(sessionStorage.getItem(RECENTS_KEY)).not.toBeNull();
    expect(localStorage.length).toBe(0);
    clearRecents();
    expect(sessionStorage.getItem(RECENTS_KEY)).toBeNull();
  });

  it('survives a throwing storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readRecents()).toEqual([]);
    expect(() => pushRecent(rec(1))).not.toThrow();
    expect(() => clearRecents()).not.toThrow();
  });

  it('ignores corrupt stored data', () => {
    sessionStorage.setItem(RECENTS_KEY, '{not json');
    expect(readRecents()).toEqual([]);
  });
});
