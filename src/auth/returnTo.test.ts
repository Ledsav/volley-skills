import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSafeReturnPath, rememberReturnTo, takeReturnTo } from './returnTo';

describe('returnTo', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a path once', () => {
    rememberReturnTo('/teams/t1/matches/m1');
    expect(takeReturnTo()).toBe('/teams/t1/matches/m1');
    expect(takeReturnTo()).toBe('/');
  });

  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', 'teams'])(
    'rejects %s',
    (p) => {
      expect(isSafeReturnPath(p)).toBe(false);
      rememberReturnTo(p);
      expect(takeReturnTo()).toBe('/');
    },
  );

  it('does not remember login or the sign-in callback', () => {
    rememberReturnTo('/login');
    expect(takeReturnTo()).toBe('/');
    rememberReturnTo('/finish-sign-in?x=1');
    expect(takeReturnTo()).toBe('/');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => rememberReturnTo('/teams')).not.toThrow();
    expect(takeReturnTo()).toBe('/');
  });
});
