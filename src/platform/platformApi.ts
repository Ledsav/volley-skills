import {
  collection, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, Timestamp, where, writeBatch,
  type QueryConstraint, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Club, ClubStatus } from '../types/club';

// The operator has no active club, so paths are explicit rather than from clubPaths.
export const CLUBS_PAGE = 50;

export async function listClubs(opts: { status: ClubStatus | null; after: QueryDocumentSnapshot | null }):
Promise<{ clubs: Club[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
  if (opts.status) constraints.push(where('status', '==', opts.status));
  constraints.push(limit(CLUBS_PAGE));
  if (opts.after) constraints.push(startAfter(opts.after));
  const snap = await getDocs(query(collection(db, 'clubs'), ...constraints));
  return {
    clubs: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Club),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === CLUBS_PAGE,
  };
}

export interface StatusChange {
  clubId: string;
  from: ClubStatus;
  to: ClubStatus;
  reason: string | null;
  /** A Timestamp is written as is, so a kept end date stays exactly the stored one. */
  dates?: { effectiveAt: Date | Timestamp | null; retrievalEndsAt: Date | Timestamp | null };
}

const ts = (d: Date | Timestamp | null) => (d instanceof Date ? Timestamp.fromDate(d) : d);

// One batch: the club update plus the statusLog entry the rules require alongside it.
// Reinstating (terminating -> active) clears the termination dates and the club's request.
export async function changeClubStatus(change: StatusChange, operatorEmail: string): Promise<void> {
  const { clubId, from, to, reason } = change;
  const by = operatorEmail.toLowerCase();
  const clubRef = doc(db, 'clubs', clubId);
  const logRef = doc(collection(db, 'clubs', clubId, 'statusLog'));
  const reinstate = from === 'terminating' && to === 'active';
  const dates = change.dates ?? (reinstate ? { effectiveAt: null, retrievalEndsAt: null } : undefined);

  const patch: Record<string, unknown> = {
    status: to,
    statusReason: reason,
    statusChangedAt: serverTimestamp(),
    statusChangedBy: by,
    lastStatusLogId: logRef.id,
  };
  if (dates) {
    patch['termination.effectiveAt'] = ts(dates.effectiveAt);
    patch['termination.retrievalEndsAt'] = ts(dates.retrievalEndsAt);
  }
  if (reinstate) {
    patch['termination.requestedAt'] = null;
    patch['termination.requestedBy'] = null;
  }

  const batch = writeBatch(db);
  batch.update(clubRef, patch);
  batch.set(logRef, { from, to, reason, by, at: serverTimestamp() });
  await batch.commit();
}
