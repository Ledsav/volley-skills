import { useEffect, useState } from 'react';

function matches(query: string, fallback: boolean): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return fallback;
  return window.matchMedia(query).matches;
}

/**
 * Tracks whether a CSS media query currently matches. Used where a layout
 * differs structurally between breakpoints (not just in styling), so only one
 * variant is mounted. `fallback` is returned when `matchMedia` is unavailable
 * (e.g. jsdom in tests).
 */
export function useMediaQuery(query: string, fallback = true): boolean {
  const [isMatch, setIsMatch] = useState(() => matches(query, fallback));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setIsMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return isMatch;
}
