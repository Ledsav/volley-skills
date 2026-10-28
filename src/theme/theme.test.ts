import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { applyTheme, getInitialTheme, getThemePreference, setThemePreference, startSystemThemeSync } from './theme';

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

/** A matchMedia mock whose `change` listeners can be fired. */
function mockControllableMatchMedia(initial: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mq = {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_: string, l: (e: { matches: boolean }) => void) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l)),
  };
  window.matchMedia = vi.fn().mockImplementation(() => mq) as unknown as typeof window.matchMedia;
  return {
    fire(matches: boolean) {
      mq.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
    listeners,
  };
}

describe('theme preference (System option)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });
  afterEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('getThemePreference is system when nothing is stored, and the stored explicit choice otherwise', () => {
    mockMatchMedia(false);
    expect(getThemePreference()).toBe('system');
    localStorage.setItem('theme', 'dark');
    expect(getThemePreference()).toBe('dark');
    localStorage.setItem('theme', 'junk');
    expect(getThemePreference()).toBe('system');
  });

  it('setThemePreference(system) removes the stored key and follows the OS', () => {
    mockMatchMedia(true);
    localStorage.setItem('theme', 'light');
    setThemePreference('system');
    expect(localStorage.getItem('theme')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('startSystemThemeSync follows OS changes while the preference is system', () => {
    const mq = mockControllableMatchMedia(false);
    const stop = startSystemThemeSync();
    mq.fire(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    stop();
    expect(mq.listeners.size).toBe(0);
  });

  it('startSystemThemeSync ignores OS changes under an explicit preference', () => {
    const mq = mockControllableMatchMedia(false);
    setThemePreference('light');
    const stop = startSystemThemeSync();
    mq.fire(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    stop();
  });
});
