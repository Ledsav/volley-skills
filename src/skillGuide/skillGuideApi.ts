import { getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { clubDoc } from '../firebase/clubPaths';
import { getT } from '../i18n/I18nProvider';
import { skillGuide } from '../i18n/en/skillGuide';
import type { SkillGuideConfig, SkillGuideEntry } from '../types/skillGuide';

/**
 * The English fallback. Until an admin saves `config/skillGuide`, `getSkillGuide` returns the fallback in the
 * active UI language (`t.skillGuide.defaults`); a saved guide is club content and is returned as stored, in
 * every language. Nothing here writes a fallback to Firestore: only an explicit save does.
 */
export const DEFAULT_SKILL_GUIDE: SkillGuideEntry[] = skillGuide.defaults;

export async function getSkillGuide(): Promise<SkillGuideConfig> {
  const snapshot = await getDoc(clubDoc('config', 'skillGuide'));
  return snapshot.exists()
    ? (snapshot.data() as SkillGuideConfig)
    : { skills: getT().skillGuide.defaults, updatedBy: '', updatedAt: null };
}

export async function updateSkillGuide(skills: SkillGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(clubDoc('config', 'skillGuide'), { skills, updatedBy, updatedAt: serverTimestamp() });
}
