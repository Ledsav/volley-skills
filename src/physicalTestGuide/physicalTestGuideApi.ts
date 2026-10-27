import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { clubDoc } from '../firebase/clubPaths';
import { getT } from '../i18n/I18nProvider';
import { physicalTestGuide } from '../i18n/en/physicalTestGuide';
import type { PhysicalTestGuideConfig, PhysicalTestGuideEntry } from '../types/physicalTestGuide';

/**
 * The English fallback. Until an admin saves `config/physicalTestGuide`, `getPhysicalTestGuide` returns the
 * fallback in the active UI language (`t.physicalTestGuide.defaults`); a saved guide is club content and is
 * returned as stored, in every language. Nothing here writes a fallback to Firestore: only an explicit save does.
 */
export const DEFAULT_PHYSICAL_TEST_GUIDE: PhysicalTestGuideEntry[] = physicalTestGuide.defaults;

export async function getPhysicalTestGuide(): Promise<PhysicalTestGuideConfig> {
  const snapshot = await getDoc(clubDoc('config', 'physicalTestGuide'));
  return snapshot.exists()
    ? (snapshot.data() as PhysicalTestGuideConfig)
    : { tests: getT().physicalTestGuide.defaults, updatedBy: '', updatedAt: null };
}

export async function updatePhysicalTestGuide(tests: PhysicalTestGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(clubDoc('config', 'physicalTestGuide'), { tests, updatedBy, updatedAt: serverTimestamp() });
}
