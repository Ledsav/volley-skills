import { clearIndexedDbPersistence } from 'firebase/firestore';
import { db } from './config';

/**
 * Bumped when stored data moves (2 = the club platform migration, spec §9.7): a
 * device that used the app before holds cached top-level docs and maybe queued
 * writes to paths that no longer exist. The cache is cleared once, before the app
 * renders. `clearIndexedDbPersistence` is allowed on a Firestore instance that has
 * not started yet, so no terminate and no reload are needed (no reload loop, even
 * for a crawler with no storage).
 *
 * Other open tabs: the delete asks them to let go of the database, and their
 * Firestore shuts down (they stop syncing until reloaded). A tab that does not
 * answer (e.g. frozen in the background) holds the delete; after CLEAR_TIMEOUT_MS
 * the app renders anyway, but its Firestore calls wait behind the delete, so the
 * page keeps loading until that tab is closed. The key stays unset then, so a
 * later load tries again.
 */
export const SCHEMA_VERSION = '2';
export const SCHEMA_KEY = 'vcb.schemaVersion';
export const CLEAR_TIMEOUT_MS = 3000;

interface Deps {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  clear?: () => Promise<void>;
}

/** Never rejects. If the cache cannot be cleared (another tab holds it), a later load retries. */
export async function resetCacheIfSchemaChanged({
  storage = window.localStorage,
  clear = () => clearIndexedDbPersistence(db),
}: Deps = {}): Promise<void> {
  try {
    if (storage.getItem(SCHEMA_KEY) === SCHEMA_VERSION) return;
  } catch {
    return; // Storage blocked (private mode): nothing to remember the reset by, so leave the cache alone.
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      clear(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), CLEAR_TIMEOUT_MS);
      }),
    ]);
    storage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
  } catch {
    // The clear failed, or another tab has not let go yet (see above): try again next load.
  } finally {
    clearTimeout(timer);
  }
}
