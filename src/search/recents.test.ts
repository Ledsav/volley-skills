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
    for (let i = 1; i <= 10; i++) pushRecent('c1', rec(i));
    pushRecent('c1', rec(5));
    const ids = readRecents('c1').map((r) => r.id);
    expect(ids).toHaveLength(8);
    expect(ids[0]).toBe('t5');
    expect(ids.filter((id) => id === 't5')).toHaveLength(1);
    expect(ids).toEqual(['t5', 't10', 't9', 't8', 't7', 't6', 't4', 't3']);
  });

  it('uses sessionStorage, never localStorage', () => {
    pushRecent('c1', rec(1));
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
    expect(readRecents('c1')).toEqual([]);
    expect(() => pushRecent('c1', rec(1))).not.toThrow();
    expect(() => clearRecents()).not.toThrow();
  });

  it('a different club id reads empty and replaces the list', () => {
    pushRecent('c1', rec(1));
    expect(readRecents('c2')).toEqual([]);
    expect(sessionStorage.getItem(RECENTS_KEY)).toBeNull();
    pushRecent('c1', rec(1));
    pushRecent('c2', rec(2));
    expect(readRecents('c2').map((r) => r.id)).toEqual(['t2']);
    expect(readRecents('c1')).toEqual([]);
  });

  it('ignores corrupt stored data', () => {
    sessionStorage.setItem(RECENTS_KEY, '{not json');
    expect(readRecents('c1')).toEqual([]);
  });

  it('is keyed by club and person', () => {
    pushRecent('c1|a@x.org', rec(1));
    expect(readRecents('c1|b@x.org')).toEqual([]);
  });

  it('drops entries with a wrong shape', () => {
    sessionStorage.setItem(
      RECENTS_KEY,
      JSON.stringify({ key: 'c1', items: [{ id: 3, group: 'teams', label: 'x', to: '/x' }, null, 'str', rec(2)] }),
    );
    expect(readRecents('c1').map((r) => r.id)).toEqual(['t2']);
  });
});
