import { collection, doc, getDoc, type CollectionReference } from 'firebase/firestore';
import { db } from '../firebase/config';
import { readAll } from '../firebase/readAll';
import type { TeamExportData, TeamExportOptions } from './teamExport';

async function docs(col: CollectionReference) {
  return (await readAll(col)).map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Reads everything stored under a team for a full export. Every collection is
 * paged (never one unbounded read). Raw scouting events cost one read per
 * event, hundreds per match, so they are opt-in.
 */
export async function loadTeamExportData(teamId: string, options: TeamExportOptions): Promise<TeamExportData> {
  const sub = (...path: string[]) => collection(db, 'teams', teamId, ...(path as [string]));
  const teamSnap = await getDoc(doc(db, 'teams', teamId));
  if (!teamSnap.exists()) throw new Error('team not found');

  const players = [];
  for (const player of await docs(sub('players'))) {
    players.push({ player, physicalTests: await docs(sub('players', player.id, 'physicalTests')) });
  }

  const testingSessions = [];
  for (const session of await docs(sub('testingSessions'))) {
    testingSessions.push({ session, entries: await docs(sub('testingSessions', session.id, 'entries')) });
  }

  const matches = [];
  for (const match of await docs(sub('matches'))) {
    matches.push({ match, events: options.includeEvents ? await docs(sub('matches', match.id, 'events')) : null });
  }

  return {
    team: { id: teamSnap.id, ...teamSnap.data() },
    players,
    testingSessions,
    matches,
    calendar: options.includeCalendar ? await docs(sub('calendar')) : null,
    scoutProfile: await docs(sub('scoutProfile')),
  };
}
