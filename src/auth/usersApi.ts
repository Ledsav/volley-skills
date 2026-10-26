import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser } from '../types/auth';

/** `email` must already be lowercased: the users rule compares it with the token's. */
export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (!existing.exists()) {
    await setDoc(userRef, { email, createdAt: serverTimestamp() });
  }
  return { uid, email };
}
