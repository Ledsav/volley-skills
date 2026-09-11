import { doc, getDoc, setDoc, type FirestoreError } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { AppUser, UserRole } from '../types/auth';

function normalizeRole(raw: string): UserRole {
  if (raw === 'superadmin' || raw === 'admin') return 'superadmin';
  return 'member';
}

export async function ensureUserDoc(uid: string, email: string): Promise<AppUser> {
  const userRef = doc(db, 'users', uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data() as { email: string; role: string };
    return { uid, email: data.email, role: normalizeRole(data.role) };
  }

  try {
    await setDoc(userRef, { email, role: 'superadmin' });
    return { uid, email, role: 'superadmin' };
  } catch (error) {
    if ((error as FirestoreError).code !== 'permission-denied') {
      throw error;
    }
    await setDoc(userRef, { email, role: 'member' });
    return { uid, email, role: 'member' };
  }
}
