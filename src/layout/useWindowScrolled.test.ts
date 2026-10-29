import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useWindowScrolled } from './useWindowScrolled';

afterEach(() => {
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});

describe('useWindowScrolled', () => {
  it('turns true once the window scrolls', () => {
    const { result } = renderHook(() => useWindowScrolled());
    expect(result.current).toBe(false);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 24, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(false);
  });
});
