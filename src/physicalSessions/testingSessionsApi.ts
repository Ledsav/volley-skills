import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { createPhysicalTest } from '../players/physicalTestsApi';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import type { NewPhysicalTestInput, PhysicalTestType } from '../types/physicalTest';
import type { TestingSession } from '../types/testingSession';

const PAST_SESSIONS_CAP = 50;

export async function startSession(teamId: string, date: string, creatorUid: string): Promise<string> {
  const teamRef = doc(db, 'teams', teamId);
  const sessionRef = doc(collection(db, 'teams', teamId, 'testingSessions'));

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamRef);
    const activeId = (teamSnap.data() as { activeTestingSessionId?: string | null } | undefined)?.activeTestingSessionId;
    if (activeId) {
      throw new Error('A testing session is already open for this team.');
    }
    tx.set(sessionRef, {
      date,
      status: 'open',
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      closedAt: null,
    });
    tx.update(teamRef, { activeTestingSessionId: sessionRef.id });
  });

  return sessionRef.id;
}

export async function closeSession(teamId: string, sessionId: string): Promise<void> {
  const teamRef = doc(db, 'teams', teamId);
  const sessionRef = doc(db, 'teams', teamId, 'testingSessions', sessionId);

  await runTransaction(db, async (tx) => {
    tx.update(sessionRef, { status: 'closed', closedAt: serverTimestamp() });
    tx.update(teamRef, { activeTestingSessionId: null });
  });
}

export async function getSession(teamId: string, sessionId: string): Promise<TestingSession | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId, 'testingSessions', sessionId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as TestingSession;
}

export async function listPastSessions(teamId: string): Promise<TestingSession[]> {
  const base = collection(db, 'teams', teamId, 'testingSessions');
  const snapshot = await getDocs(
    query(base, where('status', '==', 'closed'), orderBy('date', 'desc'), limit(PAST_SESSIONS_CAP))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSession);
}

export async function getEntries(teamId: string, sessionId: string): Promise<TestingSessionEntry[]> {
  const snapshot = await getDocs(collection(db, 'teams', teamId, 'testingSessions', sessionId, 'entries'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSessionEntry);
}

export async function saveEntryProgress(
  teamId: string,
  sessionId: string,
  playerId: string,
  testType: PhysicalTestType,
  data: Record<string, unknown>
): Promise<void> {
  const entryId = buildEntryId(playerId, testType);
  const ref = doc(db, 'teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
  await setDoc(
    ref,
    { playerId, testType, status: 'in_progress', data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function finishEntry(
  teamId: string,
  sessionId: string,
  playerId: string,
  testType: PhysicalTestType,
  input: NewPhysicalTestInput,
  recordedByUid: string
): Promise<string> {
  const resultTestId = await createPhysicalTest(teamId, playerId, input, recordedByUid);
  const entryId = buildEntryId(playerId, testType);
  const ref = doc(db, 'teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
  await setDoc(ref, { status: 'complete', resultTestId, updatedAt: serverTimestamp() }, { merge: true });
  return resultTestId;
}
