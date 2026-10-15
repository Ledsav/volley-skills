import { describe, expect, it } from 'vitest';
import { isManyErrors, isWeakAttack, isWeakReception, weakClass, WEAK_CLASS } from './statFlags';

describe('statFlags', () => {
  it('flags reception below 40% positive, never a missing value', () => {
    expect(isWeakReception(0.39)).toBe(true);
    expect(isWeakReception(0.4)).toBe(false);
    expect(isWeakReception(null)).toBe(false);
  });

  it('flags negative attack efficiency only', () => {
    expect(isWeakAttack(-0.01)).toBe(true);
    expect(isWeakAttack(0)).toBe(false);
    expect(isWeakAttack(null)).toBe(false);
  });

  it('flags three or more errors in a match', () => {
    expect(isManyErrors(2)).toBe(false);
    expect(isManyErrors(3)).toBe(true);
  });

  it('maps to the red-strong text class', () => {
    expect(weakClass(true)).toBe(WEAK_CLASS);
    expect(WEAK_CLASS).toContain('text-red-strong');
    expect(weakClass(false)).toBe('');
  });
});
