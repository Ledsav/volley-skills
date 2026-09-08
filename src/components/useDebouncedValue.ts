import { useEffect, useState } from 'react';

/**
 * Returns `value` unchanged until it has stopped changing for `delayMs`, then
 * settles on the latest value. Used to keep a free-text filter from firing a
 * Firestore query on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
