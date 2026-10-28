import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  getInitialTheme,
  getThemePreference,
  setThemePreference,
  THEME_CHANGED_EVENT,
  type Theme,
  type ThemePreference,
} from './theme';

/** The current theme and a toggle; every caller follows changes made anywhere else. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    window.addEventListener(THEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, sync);
  }, []);

  // Only an explicit toggle persists. Mounting, or an OS change under 'system', must not store a choice.
  const toggle = useCallback(() => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }, []);
  return [theme, toggle];
}

/** The stored preference (including 'system') and a setter; follows changes made anywhere else. */
export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());

  useEffect(() => {
    const sync = () => setPref(getThemePreference());
    window.addEventListener(THEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, sync);
  }, []);

  const set = useCallback((p: ThemePreference) => {
    setThemePreference(p);
    setPref(p);
  }, []);
  return [pref, set];
}
