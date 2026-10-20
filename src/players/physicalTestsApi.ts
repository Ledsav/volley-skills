import {
    collection,
    deleteDoc,
    deleteField,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    serverTimestamp,
    startAfter,
    updateDoc,
    where,
    writeBatch,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { PHYSICAL_TEST_ORDER, type NewPhysicalTestInput, type PhysicalTest, type PhysicalTestType } from '../types/physicalTest';
import type { LatestTests } from '../types/player';

const HISTORY_PAGE_SIZE = 10;
const FULL_HISTORY_CAP = 500;
const TREND_SERIES_CAP = 60;

const playerRef = (teamId: string, playerId: string) => doc(db, 'teams', teamId, 'players', playerId);

async function readLatestTests(teamId: string, playerId: string): Promise<LatestTests | undefined> {
  const snapshot = await getDoc(playerRef(teamId, playerId));
  return (snapshot.data() as { latestTests?: LatestTests } | undefined)?.latestTests;
}

/**
 * Writes the test and, in the same batch, refreshes the player's `latestTests`
 * entry when this is the newest test of its type (tests can be backdated). A
 * batch rather than a transaction so it queues offline like any other write.
 */
export async function createPhysicalTest(
  teamId: string,
  playerId: string,
  input: NewPhysicalTestInput,
  recordedByUid: string
): Promise<string> {
  let latest: LatestTests | undefined;
  let unknown = false;
  try {
    latest = await readLatestTests(teamId, playerId);
  } catch {
    unknown = true; // offline with nothing cached
  }
  const testRef = doc(collection(db, 'teams', teamId, 'players', playerId, 'physicalTests'));
  const data = { ...input, recordedBy: recordedByUid, createdAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(testRef, data);
  const current = latest?.[input.testType];
  if (unknown) {
    // Can't tell whether this is the newest: drop the map so the next view rebuilds it.
    batch.update(playerRef(teamId, playerId), { latestTests: deleteField() });
  } else if (latest && (!current || input.date >= current.date)) {
    batch.update(playerRef(teamId, playerId), { [`latestTests.${input.testType}`]: { id: testRef.id, ...data } });
  }
  // Without a map yet, leave it alone: loadLatestTests backfills it from queries.
  await batch.commit();
  return testRef.id;
}

export async function getPhysicalTest(teamId: string, playerId: string, testId: string): Promise<PhysicalTest | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId, 'players', playerId, 'physicalTests', testId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PhysicalTest;
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

/** Deletes a test; when it was the latest of its type, the next newest takes its place. */
export async function deletePhysicalTest(teamId: string, playerId: string, testId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId, 'physicalTests', testId));
  const latest = await readLatestTests(teamId, playerId);
  const testType = PHYSICAL_TEST_ORDER.find((t) => latest?.[t]?.id === testId);
  if (!testType) return;
  const replacement = await getLatestByType(teamId, playerId, testType);
  await updateDoc(playerRef(teamId, playerId), { [`latestTests.${testType}`]: replacement ?? deleteField() });
}

/**
 * Latest test per type. Uses the map on the player doc (0 extra reads); a
 * player without one falls back to one `limit(1)` query per type, and an admin
 * then writes the result back so the next view is free.
 */
export async function loadLatestTests(
  teamId: string,
  playerId: string,
  stored: LatestTests | undefined,
  canBackfill: boolean
): Promise<LatestTests> {
  if (stored) return stored;
  const entries = await Promise.all(PHYSICAL_TEST_ORDER.map((t) => getLatestByType(teamId, playerId, t)));
  const latest: LatestTests = {};
  PHYSICAL_TEST_ORDER.forEach((t, i) => {
    const test = entries[i];
    if (test) latest[t] = test;
  });
  if (canBackfill) await updateDoc(playerRef(teamId, playerId), { latestTests: latest }).catch(() => undefined);
  return latest;
}

/** Fresh map after an add/delete on this device (one player-doc read). */
export async function fetchLatestTests(teamId: string, playerId: string, canBackfill: boolean): Promise<LatestTests> {
  return loadLatestTests(teamId, playerId, await readLatestTests(teamId, playerId), canBackfill);
}
