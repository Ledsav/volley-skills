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
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { withBackoff } from '../firebase/withBackoff';
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import { computeAvgScore, computeLevel } from './skillMath';
import {
  SKILL_KEYS,
  type Player,
  type PositionCategory,
  type SkillKey,
  type Guardian,
  type Skills,
} from '../types/player';
import type { Team } from '../types/team';
import type { DevelopmentPlan } from '../types/developmentPlan';
import type { PlayerImportInput } from './playersImport';

const PLAYERS_PAGE_SIZE = 25;

const EMPTY_SKILLS: Record<SkillKey, { score: null; notes: string; priority: boolean }> = {
  serve: { score: null, notes: '', priority: false },
  attack: { score: null, notes: '', priority: false },
  block: { score: null, notes: '', priority: false },
  set: { score: null, notes: '', priority: false },
  defence: { score: null, notes: '', priority: false },
  reception: { score: null, notes: '', priority: false },
  jump: { score: null, notes: '', priority: false },
  speed: { score: null, notes: '', priority: false },
  iq: { score: null, notes: '', priority: false },
};

export interface NewPlayerInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  positionCategory?: PositionCategory;
  playerPhone: string;
  guardians: Guardian[];
}

/** Older player docs predate the lineup fields; fill sensible defaults on read. */
function hydratePlayer(id: string, data: Record<string, unknown>): Player {
  return {
    positionCategory: 'TBD',
    starting: false,
    ...data,
    id,
  } as Player;
}

export async function createPlayer(
  teamId: string,
  team: Team,
  input: NewPlayerInput,
  creatorUid: string,
  confirmedByEmail: string
): Promise<string> {
  const docRef = await addDoc(collection(db, 'teams', teamId, 'players'), {
    ...input,
    positionCategory: input.positionCategory ?? 'TBD',
    starting: false,
    viewerEmails: [],
    teamName: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    skills: EMPTY_SKILLS,
    avgScore: null,
    level: null,
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: true, date: new Date().toISOString().slice(0, 10), confirmedBy: confirmedByEmail },
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function bulkCreatePlayers(
  teamId: string,
  team: Team,
  inputs: PlayerImportInput[],
  creatorUid: string
): Promise<number> {
  if (inputs.length > MAX_IMPORT) throw new Error(`bulk import is capped at ${MAX_IMPORT} entries per call`);
  const batch = writeBatch(db);
  for (const input of inputs) {
    const skills = SKILL_KEYS.reduce(
      (acc, key) => {
        acc[key] = { score: input.skills[key], notes: '', priority: false };
        return acc;
      },
      {} as Skills
    );
    const avgScore = computeAvgScore(skills);
    const level = computeLevel(avgScore);
    const { skills: _skills, ...contact } = input;
    void _skills;
    const ref = doc(collection(db, 'teams', teamId, 'players'));
    batch.set(ref, {
      ...contact,
      positionCategory: contact.positionCategory ?? 'TBD',
      starting: false,
      viewerEmails: [],
      teamName: team.name,
      ageGroup: team.ageGroup,
      season: team.season,
      skills,
      avgScore,
      level,
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
      consent: { given: false, date: null, confirmedBy: null },
      createdBy: creatorUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  await withBackoff(() => batch.commit());
  return inputs.length;
}

export interface PlayersPage {
  players: Player[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listPlayers(teamId: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<PlayersPage> {
  const base = collection(db, 'teams', teamId, 'players');
  const q = afterDoc
    ? query(base, orderBy('number'), startAfter(afterDoc), limit(PLAYERS_PAGE_SIZE))
    : query(base, orderBy('number'), limit(PLAYERS_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const players = snapshot.docs.map((d) => hydratePlayer(d.id, d.data()));
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { players, lastDoc, hasMore: snapshot.docs.length === PLAYERS_PAGE_SIZE };
}

export async function getPlayer(teamId: string, playerId: string): Promise<Player | null> {
  const snapshot = await getDoc(doc(db, 'teams', teamId, 'players', playerId));
  if (!snapshot.exists()) return null;
  return hydratePlayer(snapshot.id, snapshot.data());
}

export async function updatePlayerContact(
  teamId: string,
  playerId: string,
  updates: Partial<NewPlayerInput> & { starting?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { ...updates, updatedAt: serverTimestamp() });
}

export async function setPlayerStarting(teamId: string, playerId: string, starting: boolean): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { starting, updatedAt: serverTimestamp() });
}

export async function updatePlayerGuardians(teamId: string, playerId: string, guardians: Guardian[]): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { guardians, updatedAt: serverTimestamp() });
}

export async function updatePlayerSkills(
  teamId: string,
  playerId: string,
  skills: Player['skills'],
  avgScore: number | null,
  level: Player['level']
): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), {
    skills,
    avgScore,
    level,
    updatedAt: serverTimestamp(),
  });
}

export async function updatePlayerDevelopmentPlan(teamId: string, playerId: string, plan: DevelopmentPlan): Promise<void> {
  await updateDoc(doc(db, 'teams', teamId, 'players', playerId), { developmentPlan: plan, updatedAt: serverTimestamp() });
}

export async function deletePlayer(teamId: string, playerId: string): Promise<void> {
  const testsSnapshot = await getDocs(collection(db, 'teams', teamId, 'players', playerId, 'physicalTests'));
  await Promise.all(testsSnapshot.docs.map((testDoc) => deleteDoc(testDoc.ref)));
  await deleteDoc(doc(db, 'teams', teamId, 'players', playerId));
}
