import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { signOutAndClearLocalData } from '../firebase/signOut';

/**
 * Sign-out that wipes this device's offline cache. When scouting writes have
 * not synced yet, it asks before discarding them.
 */
export function useSignOut(): { signOut: () => void; unsyncedDialog: ReactNode } {
  const [askUnsynced, setAskUnsynced] = useState(false);

  async function run(force: boolean) {
    const result = await signOutAndClearLocalData({ force });
    if (result === 'unsynced') setAskUnsynced(true);
  }

  const unsyncedDialog = askUnsynced ? (
    <ConfirmDialog
      title="Unsynced scouting actions"
      message="Some scouting actions haven't synced yet. Sign out anyway? They will be lost."
      confirmLabel="Sign out anyway"
      onCancel={() => setAskUnsynced(false)}
      onConfirm={() => {
        setAskUnsynced(false);
        void run(true);
      }}
    />
  ) : null;

  return { signOut: () => void run(false), unsyncedDialog };
}
