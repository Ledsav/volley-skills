import {
  addDoc, collection, doc, getCountFromServer, getDocs, limit, orderBy,
  query, serverTimestamp, startAfter, updateDoc, where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { InterestSignup, InterestSignupRole } from '../types/interestSignup';

const PAGE_SIZE = 50;

export async function submitInterestSignup(input: {
  name: string;
  email: string;
  role: InterestSignupRole;
}): Promise<void> {
  await addDoc(collection(db, 'interestSignups'), {
    name: input.name.trim(),
    email: input.email.trim(),
    role: input.role,
    reviewed: false,
    createdAt: serverTimestamp(),
  });
}

export async function listInterestSignups(
  afterDoc: QueryDocumentSnapshot | null = null,
): Promise<{ signups: InterestSignup[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const base = collection(db, 'interestSignups');
  const q = afterDoc
    ? query(base, orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(PAGE_SIZE))
    : query(base, orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    signups: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as InterestSignup),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export async function countUnreviewedInterestSignups(): Promise<number> {
  const q = query(collection(db, 'interestSignups'), where('reviewed', '==', false));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

export async function markInterestSignupReviewed(id: string): Promise<void> {
  await updateDoc(doc(db, 'interestSignups', id), { reviewed: true });
}
