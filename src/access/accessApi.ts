import {
  arrayRemove, arrayUnion, getDoc, getDocs, limit, orderBy,
  query, serverTimestamp, startAfter, writeBatch,
  type DocumentData, type Query, type QueryDocumentSnapshot, type WriteBatch,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol, clubDoc, getActiveClubId } from '../firebase/clubPaths';
import { SECTION_KEYS, type SectionKey } from '../auth/access';

const TEAMS_PAGE = 50;

export interface GrantSet {
  teamIds: string[];
  sections: Record<SectionKey, boolean>;
}
export interface GrantHolder { email: string; grants: GrantSet; }
export interface TeamRow { id: string; name: string }

export function emptyGrantSet(): GrantSet {
  return { teamIds: [], sections: { exercises: false, trainings: false, guides: false } };
}

export async function listAllTeams(
  afterDoc: QueryDocumentSnapshot | null = null,
): Promise<{ teams: TeamRow[]; lastDoc: QueryDocumentSnapshot | null; hasMore: boolean }> {
  const base = clubCol('teams');
  const q = afterDoc
    ? query(base, orderBy('name'), startAfter(afterDoc), limit(TEAMS_PAGE))
    : query(base, orderBy('name'), limit(TEAMS_PAGE));
  const snap = await getDocs(q);
  return {
    teams: snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id })),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === TEAMS_PAGE,
  };
}

export async function listGrantHolders(): Promise<GrantHolder[]> {
  const map = new Map<string, GrantSet>();
  const ensure = (email: string) => {
    if (!map.has(email)) map.set(email, emptyGrantSet());
    return map.get(email)!;
  };

  // all teams (paged to completion)
  let cursor: QueryDocumentSnapshot | null = null;
  do {
    const base = clubCol('teams');
    const q: Query<DocumentData> = cursor
      ? query(base, orderBy('name'), startAfter(cursor), limit(TEAMS_PAGE))
      : query(base, orderBy('name'), limit(TEAMS_PAGE));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      for (const email of (d.data().adminEmails as string[] | undefined) ?? []) {
        ensure(email).teamIds.push(d.id);
      }
    }
    cursor = snap.docs.length === TEAMS_PAGE ? snap.docs[snap.docs.length - 1] : null;
  } while (cursor);

  // sections
  for (const section of SECTION_KEYS) {
    const snap = await getDoc(clubDoc('sectionAccess', section));
    for (const email of (snap.data()?.adminEmails as string[] | undefined) ?? []) {
      ensure(email).sections[section] = true;
    }
  }

  return [...map.entries()]
    .map(([email, grants]) => ({ email, grants }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

function hasAnyGrant(g: GrantSet): boolean {
  return g.teamIds.length > 0 || SECTION_KEYS.some((s) => g.sections[s]);
}

function addGrantOps(batch: WriteBatch, email: string, next: GrantSet, prev: GrantSet): void {
  const prevTeams = new Set(prev.teamIds);
  const nextTeams = new Set(next.teamIds);
  for (const id of nextTeams) {
    if (!prevTeams.has(id)) batch.update(clubDoc('teams', id), { adminEmails: arrayUnion(email) });
  }
  for (const id of prevTeams) {
    if (!nextTeams.has(id)) batch.update(clubDoc('teams', id), { adminEmails: arrayRemove(email) });
  }
  for (const section of SECTION_KEYS) {
    if (next.sections[section] && !prev.sections[section]) {
      batch.set(clubDoc('sectionAccess', section), { adminEmails: arrayUnion(email) }, { merge: true });
    }
    if (!next.sections[section] && prev.sections[section]) {
      batch.set(clubDoc('sectionAccess', section), { adminEmails: arrayRemove(email) }, { merge: true });
    }
  }
}

// A granted person must be a club member (rules key access on the member doc).
// Member docs are only ever created here, never rewritten.
export async function saveGrants(
  rawEmail: string, next: GrantSet, prev: GrantSet, grantedBy: string,
): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const memberSnap = await getDoc(clubDoc('members', email));
  const batch = writeBatch(db);
  addGrantOps(batch, email, next, prev);
  if (!memberSnap.exists() && hasAnyGrant(next)) {
    batch.set(clubDoc('members', email), {
      email, clubId: getActiveClubId(), role: 'member',
      addedBy: grantedBy.toLowerCase(), addedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

// Admins keep their member doc (and the owner's can never be deleted).
export async function removeAllGrants(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const holder = (await listGrantHolders()).find((h) => h.email === email);
  const memberSnap = await getDoc(clubDoc('members', email));
  const batch = writeBatch(db);
  if (holder) addGrantOps(batch, email, emptyGrantSet(), holder.grants);
  if (memberSnap.exists() && memberSnap.data()?.role === 'member') {
    batch.delete(clubDoc('members', email));
  }
  await batch.commit();
}
