import { useCallback, useEffect, useState } from 'react';
import {
  getThemePreference,
  setThemePreference,
  THEME_CHANGED_EVENT,
  THEME_PREFERENCE_CHANGED_EVENT,
  type ThemePreference,
} from './theme';

/** The stored preference (including 'system') and a setter; follows changes made anywhere else. */
export function useThemePreference(): [ThemePreference, (p: ThemePreference) => void] {
  const [pref, setPref] = useState<ThemePreference>(() => getThemePreference());

  useEffect(() => {
    const sync = () => setPref(getThemePreference());
    window.addEventListener(THEME_CHANGED_EVENT, sync);
    window.addEventListener(THEME_PREFERENCE_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener(THEME_CHANGED_EVENT, sync);
      window.removeEventListener(THEME_PREFERENCE_CHANGED_EVENT, sync);
    };
  }, []);

  const set = useCallback((p: ThemePreference) => {
    setThemePreference(p);
    setPref(p);
  }, []);
  return [pref, set];
}
