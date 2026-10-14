export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage unavailable (private browsing, disabled storage) — fall through.
  }
  return prefersDark() ? 'dark' : 'light';
}

/** Fired on window after the theme changes, so every toggle on screen stays in sync. */
export const THEME_CHANGED_EVENT = 'theme-changed';

export function applyTheme(theme: Theme): void {
  const changed = document.documentElement.classList.contains('dark') !== (theme === 'dark');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (changed) window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore — theme just won't persist across reloads.
  }
}
