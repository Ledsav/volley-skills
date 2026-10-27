import {
  doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol, clubDoc } from '../firebase/clubPaths';
import { createPhysicalTest, deletePhysicalTest } from '../players/physicalTestsApi';
import { buildEntryId, type TestingSessionEntry } from '../types/testingSession';
import type { NewPhysicalTestInput, PhysicalTestType } from '../types/physicalTest';
import type { TestingSession } from '../types/testingSession';

const PAST_SESSIONS_CAP = 50;

/** Thrown by startSession; the UI shows the localised text, the message stays English for logs and tests. */
export class SessionAlreadyOpenError extends Error {
  constructor() {
    super('A testing session is already open for this team.');
    this.name = 'SessionAlreadyOpenError';
  }
}

export async function startSession(teamId: string, date: string, creatorUid: string): Promise<string> {
  const teamRef = clubDoc('teams', teamId);
  const sessionRef = doc(clubCol('teams', teamId, 'testingSessions'));

  await runTransaction(db, async (tx) => {
    const teamSnap = await tx.get(teamRef);
    const activeId = (teamSnap.data() as { activeTestingSessionId?: string | null } | undefined)?.activeTestingSessionId;
    if (activeId) {
      throw new SessionAlreadyOpenError();
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
  const teamRef = clubDoc('teams', teamId);
  const sessionRef = clubDoc('teams', teamId, 'testingSessions', sessionId);

  await runTransaction(db, async (tx) => {
    tx.update(sessionRef, { status: 'closed', closedAt: serverTimestamp() });
    tx.update(teamRef, { activeTestingSessionId: null });
  });
}

/**
 * Deletes a session (open or closed) together with what it recorded: each
 * finished result is removed from the player's history (keeping their
 * latest-result summary right), then the entries and the session go in one
 * batch, and the team stops pointing at it if it was the open one.
 */
export async function deleteSession(teamId: string, sessionId: string): Promise<void> {
  const entries = await listSessionEntries(teamId, sessionId);
  for (const e of entries) {
    if (e.status === 'complete' && e.resultTestId) await deletePhysicalTest(teamId, e.playerId, e.resultTestId);
  }
  const teamRef = clubDoc('teams', teamId);
  const team = await getDoc(teamRef);
  const batch = writeBatch(db);
  for (const e of entries) batch.delete(clubDoc('teams', teamId, 'testingSessions', sessionId, 'entries', e.id));
  batch.delete(clubDoc('teams', teamId, 'testingSessions', sessionId));
  if (team.data()?.activeTestingSessionId === sessionId) batch.update(teamRef, { activeTestingSessionId: null });
  await batch.commit();
}

export async function getSession(teamId: string, sessionId: string): Promise<TestingSession | null> {
  const snapshot = await getDoc(clubDoc('teams', teamId, 'testingSessions', sessionId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as TestingSession;
}

export async function listPastSessions(teamId: string): Promise<TestingSession[]> {
  const base = clubCol('teams', teamId, 'testingSessions');
  const snapshot = await getDocs(
    query(base, where('status', '==', 'closed'), orderBy('date', 'desc'), limit(PAST_SESSIONS_CAP))
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSession);
}

/**
 * Live entries for a session (at most players × 8 qualities). One listener
 * instead of re-reading the collection after every save: after the first load
 * only changed entries are billed, and local writes show up immediately.
 */
/** A session's entries read once (bounded: at most players × 8 qualities) — for viewing a closed session. */
export async function listSessionEntries(teamId: string, sessionId: string): Promise<TestingSessionEntry[]> {
  const snapshot = await getDocs(clubCol('teams', teamId, 'testingSessions', sessionId, 'entries'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSessionEntry);
}

export function subscribeEntries(
  teamId: string,
  sessionId: string,
  onChange: (entries: TestingSessionEntry[]) => void,
  onError: (e: Error) => void
): () => void {
  return onSnapshot(
    clubCol('teams', teamId, 'testingSessions', sessionId, 'entries'),
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TestingSessionEntry)),
    onError
  );
}

export async function saveEntryProgress(
  teamId: string,
  sessionId: string,
  playerId: string,
  testType: PhysicalTestType,
  data: Record<string, unknown>
): Promise<void> {
  const entryId = buildEntryId(playerId, testType);
  const ref = clubDoc('teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
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
  const ref = clubDoc('teams', teamId, 'testingSessions', sessionId, 'entries', entryId);
  await setDoc(ref, { status: 'complete', resultTestId, updatedAt: serverTimestamp() }, { merge: true });
  return resultTestId;
}
