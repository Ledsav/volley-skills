import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTeamsFilter, writeTeamsFilter } from './teamsFilter';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('teamsFilter', () => {
  it('defaults to all and ignores junk', () => {
    expect(readTeamsFilter()).toBe('all');
    localStorage.setItem('vcb.teamsFilter', 'banana');
    expect(readTeamsFilter()).toBe('all');
  });

  it('remembers the last choice', () => {
    writeTeamsFilter('mine');
    expect(localStorage.getItem('vcb.teamsFilter')).toBe('mine');
    expect(readTeamsFilter()).toBe('mine');
    writeTeamsFilter('all');
    expect(readTeamsFilter()).toBe('all');
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readTeamsFilter()).toBe('all');
    expect(() => writeTeamsFilter('mine')).not.toThrow();
  });
});
