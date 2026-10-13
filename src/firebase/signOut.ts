import { signOut } from 'firebase/auth';
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from 'firebase/firestore';
import { auth, db } from './config';

const PENDING_WRITES_WAIT_MS = 1_500;

/** True when local writes (e.g. offline scouting) have not reached the server within a short wait. */
async function hasUnsyncedWrites(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), PENDING_WRITES_WAIT_MS);
  });
  try {
    return await Promise.race([
      waitForPendingWrites(db).then(
        () => false,
        () => true,
      ),
      timedOut,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

interface SignOutOptions {
  /** Sign out even if some local writes have not synced (they are lost). */
  force?: boolean;
  /** Runs only when sign-out proceeds, just before auth is signed out (e.g. wipe local-only data). */
  beforeSignOut?: () => void;
  /** Full-page navigation; injectable for tests. */
  redirect?: (url: string) => void;
}

/**
 * Signs out and removes the persistent Firestore cache (IndexedDB), which holds
 * minors' match and player data, from this device. Returns 'unsynced' without
 * signing out when writes are still pending so the caller can ask first.
 * Ends with a full reload so a fresh Firestore instance is created.
 */
export async function signOutAndClearLocalData({
  force = false,
  beforeSignOut,
  redirect = (url) => window.location.assign(url),
}: SignOutOptions = {}): Promise<'unsynced' | 'signedOut'> {
  if (!force && (await hasUnsyncedWrites())) return 'unsynced';
  beforeSignOut?.();
  await signOut(auth);
  try {
    await terminate(db);
    await clearIndexedDbPersistence(db);
  } catch {
    // Another open tab can keep the cache in use; it is cleared on a later sign-out.
  }
  redirect('/login');
  return 'signedOut';
}
