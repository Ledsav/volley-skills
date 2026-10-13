import { collection, deleteField, doc, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { readAll } from '../firebase/readAll';
import type { Match } from '../types/match';
import type { TestingSession, TestingSessionEntry } from '../types/testingSession';
import { anonymizeRoster, playerMatchRecord, rosterHasPlayer, type PlayerFootprint } from './playerFootprint';

// GDPR access + erasure: a player's data also lives outside their player doc,
// in physical-testing session drafts and in match rosters/stats. These reads
// page through the team's sessions and matches; roster entries are objects in
// an array, which Firestore cannot filter on, so matches are scanned.

async function playerEntries(teamId: string, playerId: string) {
  const sessions = await readAll(collection(db, 'teams', teamId, 'testingSessions'));
  const found: { sessionId: string; sessionDate: string; entries: TestingSessionEntry[] }[] = [];
  for (const s of sessions) {
    const entries = await readAll(
      collection(db, 'teams', teamId, 'testingSessions', s.id, 'entries'),
      where('playerId', '==', playerId),
    );
    if (entries.length > 0) {
      found.push({
        sessionId: s.id,
        sessionDate: (s.data() as TestingSession).date,
        entries: entries.map((e) => ({ id: e.id, ...e.data() }) as TestingSessionEntry),
      });
    }
  }
  return found;
}

async function playerMatches(teamId: string, playerId: string): Promise<Match[]> {
  const matches = await readAll(collection(db, 'teams', teamId, 'matches'));
  return matches.map((m) => ({ id: m.id, ...m.data() }) as Match).filter((m) => rosterHasPlayer(m, playerId));
}

/** Everything about the player stored outside their player doc, for their data export. */
export async function loadPlayerFootprint(teamId: string, playerId: string): Promise<PlayerFootprint> {
  const [sessions, matches] = await Promise.all([playerEntries(teamId, playerId), playerMatches(teamId, playerId)]);
  return {
    testingEntries: sessions.flatMap((s) =>
      s.entries.map((entry) => ({ sessionId: s.sessionId, sessionDate: s.sessionDate, entry })),
    ),
    matches: matches.map((m) => playerMatchRecord(m, playerId)).filter((r) => r !== null),
  };
}

/**
 * Erases the player's data outside their player doc: deletes their testing
 * session entries, strips their name and number from every match roster
 * (stats stay keyed by an id that no longer points to anyone, so team totals
 * still add up) and drops them from the scouting usage profile.
 */
export async function erasePlayerFootprint(teamId: string, playerId: string): Promise<void> {
  for (const s of await playerEntries(teamId, playerId)) {
    const batch = writeBatch(db);
    s.entries.forEach((e) => batch.delete(doc(db, 'teams', teamId, 'testingSessions', s.sessionId, 'entries', e.id)));
    await batch.commit();
  }
  for (const m of await playerMatches(teamId, playerId)) {
    await updateDoc(doc(db, 'teams', teamId, 'matches', m.id), { roster: anonymizeRoster(m.roster, playerId) });
  }
  await setDoc(
    doc(db, 'teams', teamId, 'scoutProfile', 'usage'),
    { players: { [playerId]: deleteField() } },
    { merge: true },
  );
}
