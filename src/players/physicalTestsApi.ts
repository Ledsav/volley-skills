import {
    addDoc,
    collection,
    deleteDoc,
    doc,
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
const FULL_HISTORY_CAP = 500;
const TREND_SERIES_CAP = 60;

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

export async function listAllPhysicalTests(teamId: string, playerId: string): Promise<PhysicalTest[]> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const snapshot = await getDocs(query(base, orderBy('date', 'desc'), limit(FULL_HISTORY_CAP)));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PhysicalTest);
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

/** Oldest-first series for one test type, for plotting a trend chart. */
export async function listSeriesByType(
  teamId: string,
  playerId: string,
  testType: PhysicalTestType,
  cap = TREND_SERIES_CAP
): Promise<PhysicalTest[]> {
  const base = collection(db, 'teams', teamId, 'players', playerId, 'physicalTests');
  const q = query(base, where('testType', '==', testType), orderBy('date', 'asc'), limit(cap));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as PhysicalTest);
}

export async function deletePhysicalTest(teamId: string, playerId: string, testId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'physicalTests', testId));
}
