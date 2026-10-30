import { arrayRemove, arrayUnion, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser } from '../types/auth';
import { EMPTY_ONBOARDING, parseOnboarding, type OnboardingChange } from '../onboarding/onboardingState';

/** `email` must already be lowercased: the users rule compares it with the token's. */
export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (!existing.exists()) {
    await setDoc(userRef, { email, createdAt: serverTimestamp() });
    return { uid, email, onboarding: EMPTY_ONBOARDING };
  }
  return { uid, email, onboarding: parseOnboarding(existing.data()?.onboarding) };
}

/**
 * Field-path writes, so a doc without an `onboarding` map (every user before this feature) gets a
 * partial map created, and two devices adding different tips never overwrite each other.
 */
export function writeOnboarding(uid: string, change: OnboardingChange): Promise<void> {
  const ref = doc(db, 'users', uid);
  switch (change.kind) {
    case 'welcomed':
      return updateDoc(ref, { 'onboarding.welcomed': true });
    case 'tip':
      return updateDoc(ref, { 'onboarding.tips': arrayUnion(change.id) });
    case 'hideChecklist':
      return updateDoc(ref, { 'onboarding.hiddenChecklists': arrayUnion(change.clubId) });
    case 'showChecklist':
      return updateDoc(ref, { 'onboarding.hiddenChecklists': arrayRemove(change.clubId) });
    case 'reset':
      return updateDoc(ref, {
        'onboarding.welcomed': false,
        'onboarding.tips': [],
        'onboarding.hiddenChecklists': arrayRemove(change.clubId),
      });
  }
}
