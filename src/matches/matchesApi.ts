import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { clubCol, clubDoc } from '../firebase/clubPaths';
import { deleteCollection } from '../firebase/deleteCollection';
import { listPlayers } from '../players/playersApi';
import type { Player } from '../types/player';
import {
  EMPTY_RESULT,
  type Match,
  type MatchEvent,
  type MatchResult,
  type MatchSetupInput,
  type MatchStatus,
  type NewMatchEvent,
  type RosterEntry,
  type UsageProfile,
} from '../types/match';
import type { FinishPayload } from './finish';
import { FINISHED_MATCHES_CAP } from './limits';

const MATCHES_PAGE_SIZE = 20;
const MATCHES_MONTH_CAP = 50;
export const MATCH_EVENTS_CAP = 2000;

export const matchesCol = (teamId: string) => clubCol('teams', teamId, 'matches');
export const matchDoc = (teamId: string, matchId: string) => clubDoc('teams', teamId, 'matches', matchId);
export const eventsCol = (teamId: string, matchId: string) => clubCol('teams', teamId, 'matches', matchId, 'events');
const usageDoc = (teamId: string) => clubDoc('teams', teamId, 'scoutProfile', 'usage');

const toMatch = (id: string, data: object) => ({ id, ...data }) as Match;

interface MatchesPage {
  matches: Match[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export async function listMatches(teamId: string, afterDoc: QueryDocumentSnapshot | null = null): Promise<MatchesPage> {
  const q = afterDoc
    ? query(matchesCol(teamId), orderBy('date', 'desc'), startAfter(afterDoc), limit(MATCHES_PAGE_SIZE))
    : query(matchesCol(teamId), orderBy('date', 'desc'), limit(MATCHES_PAGE_SIZE));
  const snapshot = await getDocs(q);
  return {
    matches: snapshot.docs.map((d) => toMatch(d.id, d.data())),
    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
    hasMore: snapshot.docs.length === MATCHES_PAGE_SIZE,
  };
}

export async function listMatchesInRange(teamId: string, start: string, end: string): Promise<Match[]> {
  const snapshot = await getDocs(
    query(matchesCol(teamId), where('date', '>=', start), where('date', '<=', end), orderBy('date'), limit(MATCHES_MONTH_CAP)),
  );
  return snapshot.docs.map((d) => toMatch(d.id, d.data()));
}

/** Newest finished matches; their saved `summary` feeds player season stats without reading events. */
export async function listFinishedMatches(teamId: string): Promise<Match[]> {
  const snapshot = await getDocs(
    query(matchesCol(teamId), where('status', '==', 'finished'), orderBy('date', 'desc'), limit(FINISHED_MATCHES_CAP)),
  );
  return snapshot.docs.map((d) => toMatch(d.id, d.data()));
}

export async function getMatch(teamId: string, matchId: string): Promise<Match | null> {
  const snapshot = await getDoc(matchDoc(teamId, matchId));
  return snapshot.exists() ? toMatch(snapshot.id, snapshot.data()) : null;
}

/** Not awaited by callers: offline writes only resolve once the server acks. */
export function createMatch(teamId: string, input: MatchSetupInput, uid: string): { id: string; written: Promise<void> } {
  const ref = doc(matchesCol(teamId));
  const written = setDoc(ref, {
    ...input,
    status: 'setup',
    result: EMPTY_RESULT,
    summary: null,
    report: null,
    usageContribution: null,
    activeDevice: null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: ref.id, written };
}

export function updateMatchSetup(teamId: string, matchId: string, input: MatchSetupInput): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { ...input, updatedAt: serverTimestamp() });
}

export function setMatchStatus(teamId: string, matchId: string, status: MatchStatus): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { status, updatedAt: serverTimestamp() });
}

export function updateMatchResult(teamId: string, matchId: string, result: MatchResult): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { result, updatedAt: serverTimestamp() });
}

/** Persists per-match role changes made at a set start, so later sets default to them. */
export function updateMatchRoster(teamId: string, matchId: string, roster: RosterEntry[]): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { roster, updatedAt: serverTimestamp() });
}

/** Live match doc (device lock, status). A missing doc arrives as null. */
export function subscribeMatch(
  teamId: string,
  matchId: string,
  onChange: (m: Match | null) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    matchDoc(teamId, matchId),
    (snapshot) => onChange(snapshot.exists() ? toMatch(snapshot.id, snapshot.data()) : null),
    onError,
  );
}

export function claimDevice(teamId: string, matchId: string, deviceId: string): Promise<void> {
  return updateDoc(matchDoc(teamId, matchId), { activeDevice: { id: deviceId, at: Date.now() } });
}

export async function deleteMatch(teamId: string, matchId: string): Promise<void> {
  await deleteCollection(eventsCol(teamId, matchId));
  await deleteDoc(matchDoc(teamId, matchId));
}

export function subscribeEvents(
  teamId: string,
  matchId: string,
  onChange: (events: MatchEvent[], pending: number) => void,
  onError: (e: Error) => void,
): () => void {
  return onSnapshot(
    query(eventsCol(teamId, matchId), orderBy('order'), limit(MATCH_EVENTS_CAP)),
    { includeMetadataChanges: true },
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as MatchEvent);
      const pendingDocs = snapshot.docs.filter((d) => d.metadata.hasPendingWrites).length;
      onChange(events, pendingDocs === 0 && snapshot.metadata.hasPendingWrites ? 1 : pendingDocs);
    },
    onError,
  );
}

/** Not awaited by callers: offline writes only resolve once the server acks. */
export function addEvent(teamId: string, matchId: string, event: NewMatchEvent, uid: string): { id: string; written: Promise<void> } {
  const ref = doc(eventsCol(teamId, matchId));
  const written = setDoc(ref, { ...event, createdBy: uid, createdAt: serverTimestamp() });
  return { id: ref.id, written };
}

export function updateEvent(teamId: string, matchId: string, eventId: string, patch: Partial<NewMatchEvent>): Promise<void> {
  return updateDoc(doc(eventsCol(teamId, matchId), eventId), patch);
}

export function deleteEvents(teamId: string, matchId: string, ids: string[]): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(eventsCol(teamId, matchId), id)));
  return batch.commit();
}

export async function getUsageProfile(teamId: string): Promise<UsageProfile> {
  const snapshot = await getDoc(usageDoc(teamId));
  return snapshot.exists() ? (snapshot.data() as UsageProfile) : { players: {} };
}

export function finishMatch(teamId: string, matchId: string, payload: FinishPayload): Promise<void> {
  const batch = writeBatch(db);
  batch.update(matchDoc(teamId, matchId), {
    status: 'finished',
    summary: payload.summary,
    report: payload.report,
    usageContribution: payload.usageContribution,
    result: payload.result,
    updatedAt: serverTimestamp(),
  });
  batch.set(usageDoc(teamId), payload.usageProfile);
  return batch.commit();
}

/** Teams are ~20 players; pages through the existing bounded player query. */
export async function loadTeamRoster(teamId: string): Promise<Player[]> {
  const all: Player[] = [];
  let cursor: QueryDocumentSnapshot | null = null;
  for (;;) {
    const page = await listPlayers(teamId, cursor);
    all.push(...page.players);
    if (!page.hasMore || !page.lastDoc) return all;
    cursor = page.lastDoc;
  }
}
