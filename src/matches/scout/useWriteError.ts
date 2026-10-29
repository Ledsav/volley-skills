import { useCallback, useMemo, useRef, useState } from 'react';

export interface WriteErrorApi {
  error: string | null;
  /** Show a failure and stamp the current write sequence. */
  show(message: string): void;
  /** Observe one event write: it takes the next sequence number. */
  track(written: Promise<unknown>, message: string): void;
  dismiss(): void;
}

/**
 * The scouting write error. It clears only when an event write issued after the
 * error appeared is acknowledged, or on dismiss; acknowledgements of writes that
 * were already in flight must not hide it.
 */
export function useWriteError(): WriteErrorApi {
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);
  const stamp = useRef(0);
  const shown = useRef(false);

  const show = useCallback((message: string) => {
    stamp.current = counter.current;
    shown.current = true;
    setError(message);
  }, []);

  const track = useCallback(
    (written: Promise<unknown>, message: string) => {
      const seq = ++counter.current;
      written.then(
        () => {
          if (shown.current && seq > stamp.current) {
            shown.current = false;
            setError(null);
          }
        },
        () => show(message),
      );
    },
    [show],
  );

  const dismiss = useCallback(() => {
    shown.current = false;
    setError(null);
  }, []);

  return useMemo(() => ({ error, show, track, dismiss }), [error, show, track, dismiss]);
}
