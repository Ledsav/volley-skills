import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tapFlash } from './tapFlash';

describe('tapFlash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sets data-flash and clears it after 80 ms', () => {
    const el = document.createElement('button');
    tapFlash(el);
    expect(el.hasAttribute('data-flash')).toBe(true);
    vi.advanceTimersByTime(79);
    expect(el.hasAttribute('data-flash')).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.hasAttribute('data-flash')).toBe(false);
  });

  it('a second flash restarts the timer', () => {
    const el = document.createElement('button');
    tapFlash(el);
    vi.advanceTimersByTime(60);
    tapFlash(el);
    vi.advanceTimersByTime(60);
    expect(el.hasAttribute('data-flash')).toBe(true);
    vi.advanceTimersByTime(20);
    expect(el.hasAttribute('data-flash')).toBe(false);
  });
});
