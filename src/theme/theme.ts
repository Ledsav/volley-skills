export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
}

/** Fired on window whenever the stored preference is set, even when the resolved theme stays the same. */
export const THEME_PREFERENCE_CHANGED_EVENT = 'theme-preference-changed';

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

/** Toggles `.dark` to match `theme` without persisting, announcing a real change. */
function paintTheme(theme: Theme): void {
  const changed = document.documentElement.classList.contains('dark') !== (theme === 'dark');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (changed) window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

export function applyTheme(theme: Theme): void {
  paintTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore — theme just won't persist across reloads.
  }
}

export type ThemePreference = 'system' | 'light' | 'dark';

/** The stored explicit choice, otherwise 'system' (also when storage is corrupt or unavailable). */
export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage unavailable - follow the system.
  }
  return 'system';
}

export function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light';
  return pref;
}

/** 'system' forgets the stored choice and follows the OS; light/dark persist like applyTheme. */
export function setThemePreference(pref: ThemePreference): void {
  if (pref === 'system') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    paintTheme(resolveTheme('system'));
  } else {
    applyTheme(pref);
  }
  window.dispatchEvent(new Event(THEME_PREFERENCE_CHANGED_EVENT));
}

/** While the preference is 'system', follow live OS colour-scheme changes. Returns an unsubscribe. */
export function startSystemThemeSync(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = (e: { matches: boolean }) => {
    if (getThemePreference() === 'system') paintTheme(e.matches ? 'dark' : 'light');
  };
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
