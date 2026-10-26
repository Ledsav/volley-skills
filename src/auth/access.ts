import { getDoc, type FirestoreError } from 'firebase/firestore';
import { clubDoc } from '../firebase/clubPaths';
import type { MemberRole } from '../types/club';

export type SectionKey = 'exercises' | 'trainings' | 'guides';
export const SECTION_KEYS: readonly SectionKey[] = ['exercises', 'trainings', 'guides'];

export interface Access {
  isClubAdmin: boolean;
  sections: Record<SectionKey, boolean>;
}

async function canReadSection(section: SectionKey): Promise<boolean> {
  try {
    await getDoc(clubDoc('sectionAccess', section));
    return true;
  } catch (error) {
    if ((error as FirestoreError).code === 'permission-denied') return false;
    throw error;
  }
}

/** Access within the active club: an admin has every section, a member what the rules let them read. */
export async function resolveAccess(role: MemberRole): Promise<Access> {
  if (role === 'admin') {
    return { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
  }
  const results = await Promise.all(SECTION_KEYS.map((s) => canReadSection(s)));
  return {
    isClubAdmin: false,
    sections: {
      exercises: results[0],
      trainings: results[1],
      guides: results[2],
    },
  };
}
