import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { SkillGuideConfig, SkillGuideEntry } from '../types/skillGuide';

export async function getSkillGuide(): Promise<SkillGuideConfig | null> {
  const snapshot = await getDoc(doc(db, 'skillGuide', 'config'));
  return snapshot.exists() ? (snapshot.data() as SkillGuideConfig) : null;
}

export async function updateSkillGuide(skills: SkillGuideEntry[], updatedBy: string): Promise<void> {
  await setDoc(doc(db, 'skillGuide', 'config'), { skills, updatedBy, updatedAt: serverTimestamp() });
}
