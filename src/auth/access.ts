import { doc, getDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser } from '../types/auth';

export type SectionKey = 'exercises' | 'trainings' | 'guides';
export const SECTION_KEYS: readonly SectionKey[] = ['exercises', 'trainings', 'guides'];

export interface Access {
  isSuperAdmin: boolean;
  sections: Record<SectionKey, boolean>;
}

async function canReadSection(section: SectionKey): Promise<boolean> {
  try {
    await getDoc(doc(db, 'sectionAccess', section));
    return true;
  } catch (error) {
    if ((error as FirestoreError).code === 'permission-denied') return false;
    throw error;
  }
}

export async function resolveAccess(appUser: AppUser): Promise<Access> {
  if (appUser.role === 'superadmin') {
    return { isSuperAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
  }
  const results = await Promise.all(SECTION_KEYS.map((s) => canReadSection(s)));
  return {
    isSuperAdmin: false,
    sections: {
      exercises: results[0],
      trainings: results[1],
      guides: results[2],
    },
  };
}
