import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { clubCol, clubDoc } from '../firebase/clubPaths';
import type { CalendarSession, NewCalendarSessionInput } from '../types/calendarSession';

const CALENDAR_MONTH_CAP = 200;

export async function listCalendarSessions(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<CalendarSession[]> {
  const base = clubCol('teams', teamId, 'calendar');
  const snapshot = await getDocs(
    query(
      base,
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date'),
      limit(CALENDAR_MONTH_CAP)
    )
  );
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarSession);
}

export async function getCalendarSession(teamId: string, sessionId: string): Promise<CalendarSession | null> {
  const snapshot = await getDoc(clubDoc('teams', teamId, 'calendar', sessionId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as CalendarSession;
}

export async function createCalendarSession(
  teamId: string,
  input: NewCalendarSessionInput,
  creatorUid: string
): Promise<string> {
  const docRef = await addDoc(clubCol('teams', teamId, 'calendar'), {
    ...input,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteCalendarSession(teamId: string, sessionId: string): Promise<void> {
  await deleteDoc(clubDoc('teams', teamId, 'calendar', sessionId));
}

/** Whether the team has any session at all: one document, no index. */
export async function hasAnySession(teamId: string): Promise<boolean> {
  const snap = await getDocs(query(clubCol('teams', teamId, 'calendar'), limit(1)));
  return !snap.empty;
}
