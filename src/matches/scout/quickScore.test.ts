import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readQuickScore, writeQuickScore } from './quickScore';

describe('quickScore preference', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults off and persists', () => {
    expect(readQuickScore()).toBe(false);
    writeQuickScore(true);
    expect(readQuickScore()).toBe(true);
    writeQuickScore(false);
    expect(readQuickScore()).toBe(false);
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readQuickScore()).toBe(false);
    expect(() => writeQuickScore(true)).not.toThrow();
  });
});
