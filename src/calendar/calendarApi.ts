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
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CalendarSession, NewCalendarSessionInput } from '../types/calendarSession';

const CALENDAR_MONTH_CAP = 200;

export async function listCalendarSessions(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<CalendarSession[]> {
  const base = collection(db, 'teams', teamId, 'calendar');
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

export async function createCalendarSession(
  teamId: string,
  input: NewCalendarSessionInput,
  creatorUid: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'calendar'), {
    ...input,
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteCalendarSession(teamId: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'teams', teamId, 'calendar', sessionId));
}
