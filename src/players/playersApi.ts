import {
  addDoc,
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
import { clubCol, clubDoc } from '../firebase/clubPaths';
import { deleteCollection } from '../firebase/deleteCollection';
import { withBackoff } from '../firebase/withBackoff';
import { todayLocalIso } from '../dates/today';
import { MAX_IMPORT } from '../bulkImport/parseJsonArray';
import { erasePlayerFootprint } from './playerFootprintApi';
import { computeAvgScore, computeLevel } from './skillMath';
import {
  SKILL_KEYS,
  type Player,
  type PositionCategory,
  type ShirtSize,
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

interface NewPlayerInput {
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  positionCategory?: PositionCategory;
  shirtSize?: ShirtSize | '';
  playerPhone: string;
  guardians: Guardian[];
}

/**
 * Older player docs predate later fields (the lineup fields, the `block` skill).
 * Fill sensible defaults on read so the UI never dereferences an undefined entry.
 */
function hydratePlayer(id: string, data: Record<string, unknown>): Player {
  const rawSkills = (data.skills ?? {}) as Partial<Skills>;
  const skills = {} as Skills;
  for (const key of SKILL_KEYS) {
    skills[key] = rawSkills[key] ?? { score: null, notes: '', priority: false };
  }
  return {
    positionCategory: 'TBD',
    shirtSize: '',
    starting: false,
    leftClubAt: null,
    ...data,
    skills,
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
  const docRef = await addDoc(clubCol('teams', teamId, 'players'), {
    ...input,
    positionCategory: input.positionCategory ?? 'TBD',
    shirtSize: input.shirtSize ?? '',
    starting: false,
    viewerEmails: [],
    teamName: team.name,
    ageGroup: team.ageGroup,
    season: team.season,
    skills: EMPTY_SKILLS,
    avgScore: null,
    level: null,
    developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    consent: { given: true, date: todayLocalIso(), confirmedBy: confirmedByEmail },
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
    const ref = doc(clubCol('teams', teamId, 'players'));
    batch.set(ref, {
      ...contact,
      positionCategory: contact.positionCategory ?? 'TBD',
      shirtSize: contact.shirtSize ?? '',
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

interface PlayersPage {
  players: Player[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listPlayers(teamId: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<PlayersPage> {
  const base = clubCol('teams', teamId, 'players');
  const q = afterDoc
    ? query(base, orderBy('number'), startAfter(afterDoc), limit(PLAYERS_PAGE_SIZE))
    : query(base, orderBy('number'), limit(PLAYERS_PAGE_SIZE));
  const snapshot = await getDocs(q);
  const players = snapshot.docs.map((d) => hydratePlayer(d.id, d.data()));
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { players, lastDoc, hasMore: snapshot.docs.length === PLAYERS_PAGE_SIZE };
}

export async function getPlayer(teamId: string, playerId: string): Promise<Player | null> {
  const snapshot = await getDoc(clubDoc('teams', teamId, 'players', playerId));
  if (!snapshot.exists()) return null;
  return hydratePlayer(snapshot.id, snapshot.data());
}

export async function updatePlayerContact(
  teamId: string,
  playerId: string,
  updates: Partial<NewPlayerInput> & { starting?: boolean }
): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { ...updates, updatedAt: serverTimestamp() });
}

export async function setPlayerStarting(teamId: string, playerId: string, starting: boolean): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { starting, updatedAt: serverTimestamp() });
}

export async function updatePlayerGuardians(teamId: string, playerId: string, guardians: Guardian[]): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { guardians, updatedAt: serverTimestamp() });
}

export async function updatePlayerSkills(
  teamId: string,
  playerId: string,
  skills: Player['skills'],
  avgScore: number | null,
  level: Player['level']
): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), {
    skills,
    avgScore,
    level,
    updatedAt: serverTimestamp(),
  });
}

/** Marks the player as having left the club on `date` (null: back in the club), starting the retention clock. */
export async function setPlayerLeftClub(teamId: string, playerId: string, date: string | null): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { leftClubAt: date, updatedAt: serverTimestamp() });
}

const DUE_FOR_DELETION_CAP = 50;

/** Players who left the club on or before `cutoff` (see retention.ts), oldest first. */
export async function listPlayersDueForDeletion(teamId: string, cutoff: string): Promise<Player[]> {
  const snapshot = await getDocs(
    query(
      clubCol('teams', teamId, 'players'),
      where('leftClubAt', '<=', cutoff),
      orderBy('leftClubAt'),
      limit(DUE_FOR_DELETION_CAP),
    ),
  );
  return snapshot.docs.map((d) => hydratePlayer(d.id, d.data()));
}

/** Records guardian consent for a player created without it (bulk import). */
export async function recordPlayerConsent(
  teamId: string,
  playerId: string,
  confirmedByEmail: string,
  today: string = todayLocalIso(),
): Promise<Player['consent']> {
  const consent = { given: true, date: today, confirmedBy: confirmedByEmail };
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { consent, updatedAt: serverTimestamp() });
  return consent;
}

/** Records or withdraws the guardian's consent to use a minor's photo in award cards. Withdrawing clears the date and the email. */
export async function setPhotoConsent(teamId: string, playerId: string, given: boolean, byEmail: string): Promise<void> {
  const fields = given
    ? { photoConsent: true, photoConsentAt: serverTimestamp(), photoConsentBy: byEmail }
    : { photoConsent: false, photoConsentAt: null, photoConsentBy: null };
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { ...fields, updatedAt: serverTimestamp() });
}

export async function updatePlayerDevelopmentPlan(teamId: string, playerId: string, plan: DevelopmentPlan): Promise<void> {
  await updateDoc(clubDoc('teams', teamId, 'players', playerId), { developmentPlan: plan, updatedAt: serverTimestamp() });
}

/**
 * GDPR erasure of a minor's data. Firestore never cascades, so everything
 * else goes first (testing-session entries, match roster names, scouting
 * usage, physical tests) and the player doc last: a failed run can be retried
 * from the still-visible player.
 */
export async function deletePlayer(teamId: string, playerId: string): Promise<void> {
  await erasePlayerFootprint(teamId, playerId);
  await deleteCollection(clubCol('teams', teamId, 'players', playerId, 'physicalTests'));
  await deleteDoc(clubDoc('teams', teamId, 'players', playerId));
}
