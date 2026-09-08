import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { applyTheme, getInitialTheme } from './theme';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

describe('getInitialTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the theme stored in localStorage when present', () => {
    localStorage.setItem('theme', 'dark');
    mockMatchMedia(false);
    expect(getInitialTheme()).toBe('dark');
  });

  it('falls back to the system preference when nothing is stored', () => {
    mockMatchMedia(true);
    expect(getInitialTheme()).toBe('dark');
  });

  it('defaults to light when nothing is stored and the system has no dark preference', () => {
    mockMatchMedia(false);
    expect(getInitialTheme()).toBe('light');
  });

  it('ignores a corrupted stored value and falls back to system preference', () => {
    localStorage.setItem('theme', 'not-a-theme');
    mockMatchMedia(true);
    expect(getInitialTheme()).toBe('dark');
  });
});

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('adds the dark class to the document root when set to dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes the dark class from the document root when set to light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists the choice to localStorage', () => {
    applyTheme('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
  });
});
