import { doc, getDoc, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser, UserRole } from '../types/auth';

export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data() as { email: string; role: UserRole };
    return { uid, email: data.email, role: data.role };
  }

  try {
    await setDoc(userRef, { email, role: 'admin' });
    return { uid, email, role: 'admin' };
  } catch (error) {
    if ((error as FirestoreError).code !== 'permission-denied') {
      throw error;
    }
    await setDoc(userRef, { email, role: 'viewer' });
    return { uid, email, role: 'viewer' };
  }
}
