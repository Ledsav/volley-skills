import { useState, type ReactNode } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useT } from '../i18n/I18nProvider';
import { signOutAndClearLocalData } from '../firebase/signOut';
import { clearAiLocalData } from '../ai/aiSettings';
import { storeClub } from '../clubs/activeClub';
import { clearSignDraft } from '../legal/signDraft';
import { clearRecents } from '../search/recents';

function clearLocalState() {
  clearAiLocalData();
  storeClub(null);
  clearSignDraft();
  clearRecents();
}

/**
 * Sign-out that wipes this device's offline cache. When scouting writes have
 * not synced yet, it asks before discarding them.
 */
export function useSignOut(): { signOut: () => void; unsyncedDialog: ReactNode } {
  const t = useT().auth.signOut;
  const [askUnsynced, setAskUnsynced] = useState(false);

  async function run(force: boolean) {
    const result = await signOutAndClearLocalData({ force, beforeSignOut: clearLocalState });
    if (result === 'unsynced') setAskUnsynced(true);
  }

  const unsyncedDialog = askUnsynced ? (
    <ConfirmDialog
      title={t.unsyncedTitle}
      message={t.unsyncedMessage}
      confirmLabel={t.signOutAnyway}
      onCancel={() => setAskUnsynced(false)}
      onConfirm={() => {
        setAskUnsynced(false);
        void run(true);
      }}
    />
  ) : null;

  return { signOut: () => void run(false), unsyncedDialog };
}
