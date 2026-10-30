import {
  collectionGroup, doc, getCountFromServer, getDoc, getDocs, onSnapshot, query, where,
  type FirestoreError, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol } from '../firebase/clubPaths';
import type { Club, MemberRole, Membership } from '../types/club';

/** Every club the email belongs to; clubs that are gone or denied are skipped, other errors throw. */
export async function listMyMemberships(email: string): Promise<Membership[]> {
  const snap = await getDocs(query(collectionGroup(db, 'members'), where('email', '==', email)));
  const loaded = await Promise.all(
    snap.docs.map(async (d): Promise<Membership | null> => {
      const { clubId, role } = d.data() as { clubId: string; role: MemberRole };
      try {
        const club = await getDoc(doc(db, 'clubs', clubId));
        if (!club.exists()) return null;
        const data = club.data() as Omit<Club, 'id'>;
        return { clubId, role, clubName: data.name, status: data.status };
      } catch (error) {
        if ((error as FirestoreError).code === 'permission-denied') return null;
        throw error;
      }
    }),
  );
  return loaded.filter((m): m is Membership => m !== null);
}

/** The rules only let you read your own platformAdmins doc; a denial means no. */
export async function probePlatformAdmin(email: string): Promise<boolean> {
  try {
    return (await getDoc(doc(db, 'platformAdmins', email))).exists();
  } catch (error) {
    if ((error as FirestoreError).code === 'permission-denied') return false;
    throw error;
  }
}

/**
 * Follows the club doc live; a missing doc or a read error reports `null`.
 * Pending server timestamps read as local estimates rather than null.
 */
export function subscribeClub(clubId: string, onClub: (club: Club | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'clubs', clubId),
    (snap) => onClub(snap.exists() ? ({ id: snap.id, ...snap.data({ serverTimestamps: 'estimate' }) } as Club) : null),
    () => onClub(null),
  );
}

/** How many members the active club has, counted on the server without reading them. */
export async function countClubMembers(): Promise<number> {
  const snap = await getCountFromServer(clubCol('members'));
  return snap.data().count;
}
