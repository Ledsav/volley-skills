import {
  addDoc,
  collection,
  deleteDoc,
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
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import { deletePlayer } from '../players/playersApi';
import type { Team } from '../types/team';
import type { DevelopmentPlan } from '../types/developmentPlan';

const TEAMS_PAGE_SIZE = 20;

export interface NewTeamInput {
  name: string;
  club: string;
  ageGroup: string;
  season: string;
  description: string;
}

export async function createTeam(input: NewTeamInput, creatorUid: string, creatorEmail: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams'), {
    ...input,
    notes: '',
    adminEmails: [creatorEmail],
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function bulkCreateTeams(
  inputs: NewTeamInput[],
  creatorUid: string,
  creatorEmail: string
): Promise<number> {
  if (inputs.length > MAX_IMPORT) throw new Error(`bulk import is capped at ${MAX_IMPORT} entries per call`);
  const batch = writeBatch(db);
  for (const input of inputs) {
    const ref = doc(collection(db, 'teams'));
    batch.set(ref, {
      ...input,
      notes: '',
      adminEmails: [creatorEmail],
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  return inputs.length;
}

export interface TeamsPage {
  teams: Team[];
  lastDoc: QueryDocumentSnapshot | null;
  // A full page might still be the last one — but a page shorter than the
  // limit definitely is, so this is honest about "definitely no more" without
  // an extra read, unlike lastDoc !== null (which is true even on a final
  // full page and would show "Load more" one click too many).
  hasMore: boolean;
}

export async function listMyTeams(email: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<TeamsPage> {
  const base = collection(db, 'teams');
  const q = afterDoc
    ? query(base, where('adminEmails', 'array-contains', email), orderBy('createdAt', 'desc'), startAfter(afterDoc), limit(TEAMS_PAGE_SIZE))
    : query(base, where('adminEmails', 'array-contains', email), orderBy('createdAt', 'desc'), limit(TEAMS_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const teams = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Team);
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { teams, lastDoc, hasMore: snapshot.docs.length === TEAMS_PAGE_SIZE };
}

export async function getTeam(teamId: string): Promise<Team | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as Team;
}

export async function addTeamAdmin(teamId: string, email: string, currentAdmins: string[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { adminEmails: [...currentAdmins, email] });
}

export async function removeTeamAdmin(teamId: string, email: string, currentAdmins: string[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { adminEmails: currentAdmins.filter((e) => e !== email) });
}

export async function updateTeamInfo(
  teamId: string,
  updates: Partial<Pick<Team, 'name' | 'description' | 'notes'>>
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), updates);
}

export async function updateTeamDevelopmentPlan(teamId: string, plan: DevelopmentPlan): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId), { developmentPlan: plan });
}

export async function deleteTeam(teamId: string): Promise<void> {
  const playersSnapshot = await getDocs(collection(db, 'teams', teamId, 'players'));
  await Promise.all(playersSnapshot.docs.map((playerDoc) => deletePlayer(teamId, playerDoc.id)));
  await deleteDoc(doc(db, 'teams', teamId));
}
