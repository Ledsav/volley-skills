import { useCallback, useRef, useState } from 'react';

/** Thrown by `save` when `offline: 'block'` and the device is offline. */
export class OfflineError extends Error {
  constructor() {
    super('offline');
    this.name = 'OfflineError';
  }
}

export interface SaveOptions {
  /**
   * `queue` (default): offline, start the write and report done at once — Firestore's persistent
   * cache keeps it and syncs later (awaiting would hang until the server acks).
   * `block`: for writes that need the server (transactions, a returned id) — refuse with
   * `OfflineError` instead of hanging.
   */
  offline?: 'queue' | 'block';
}

/**
 * One save at a time for a form: a second submit while the first is in flight is ignored
 * (returns false), so a double tap can't create a duplicate. Resolves true when saved (or
 * queued offline); rethrows the write's error so the form can show its message.
 */
export function useSave() {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async (write: () => Promise<unknown>, options: SaveOptions = {}): Promise<boolean> => {
    if (busy.current) return false;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (offline && options.offline === 'block') throw new OfflineError();
    busy.current = true;
    setSaving(true);
    try {
      const pending = write();
      if (offline) {
        pending.catch(() => undefined);
        return true;
      }
      await pending;
      return true;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }, []);

  return { saving, save };
}
