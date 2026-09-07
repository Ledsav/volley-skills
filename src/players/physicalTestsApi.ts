import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { NewPhysicalTestInput, PhysicalTest, PhysicalTestType } from '../types/physicalTest';

const HISTORY_PAGE_SIZE = 10;

export async function createPhysicalTest(
  teamId: string,
  playerId: string,
  input: NewPhysicalTestInput,
  recordedByUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players', playerId, 'physicalTests'), {
    ...input,
    recordedBy: recordedByUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getLatestByType(
  teamId: string,
  playerId: string,
  testType: PhysicalTestType
): Promise<PhysicalTest | null> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const q = query(base, where('testType', '==', testType), orderBy('date', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.docs.length === 0) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as PhysicalTest;
}

export interface PhysicalTestHistoryPage {
  tests: PhysicalTest[];
  lastDoc: QueryDocumentSnapshot | null;
}

export async function listHistoryByType(
  teamId: string,
  playerId: string,
  testType: PhysicalTestType,
  afterDoc: QueryDocumentSnapshot | null = null
): Promise<PhysicalTestHistoryPage> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const q = afterDoc
    ? query(base, where('testType', '==', testType), orderBy('date', 'desc'), startAfter(afterDoc), limit(HISTORY_PAGE_SIZE))
    : query(base, where('testType', '==', testType), orderBy('date', 'desc'), limit(HISTORY_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const tests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PhysicalTest);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { tests, lastDoc };
}
