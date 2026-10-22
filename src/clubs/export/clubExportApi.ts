import { getDocFromServer, type CollectionReference, type DocumentReference } from 'firebase/firestore';
import { clubCol, clubDoc } from '../../firebase/clubPaths';
import { readAllFromServer } from '../../firebase/readAll';
import { loadTeamExportData } from '../../teams/teamExportApi';
import type { ClubExportData, ExportDoc } from './clubExport';

async function docs(col: CollectionReference): Promise<ExportDoc[]> {
  return (await readAllFromServer(col)).map((d) => ({ id: d.id, ...d.data() }));
}

async function one(ref: DocumentReference): Promise<ExportDoc | null> {
  const snap = await getDocFromServer(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Reads everything the active club stores, for the club export (spec §7.2). The one
 * sanctioned "read everything": every collection is paged, never one unbounded
 * read, and read from the server only, so a dropped connection fails the export
 * instead of zipping whatever the offline cache holds. `config` is read by id
 * because its rule names the doc ids, so a list could not pass
 * (tests/rules/export.rules.test.ts pins every read).
 */
export async function loadClubExportData(onProgress: (label: string) => void): Promise<ClubExportData> {
  onProgress('Club and people');
  const club = await one(clubDoc());
  if (!club) throw new Error('club not found');
  const members = await docs(clubCol('members'));
  const acceptances = await docs(clubCol('acceptances'));
  const statusLog = await docs(clubCol('statusLog'));

  const teamDocs = await docs(clubCol('teams'));
  const teams: ClubExportData['teams'] = [];
  for (const [i, team] of teamDocs.entries()) {
    onProgress(`Team ${i + 1} of ${teamDocs.length}: ${typeof team.name === 'string' ? team.name : team.id}`);
    teams.push({
      data: await loadTeamExportData(team.id, { includeEvents: true, includeCalendar: true }),
      awards: await docs(clubCol('teams', team.id, 'awards')),
    });
  }

  onProgress('Library');
  const exercises: ClubExportData['exercises'] = [];
  for (const exercise of await docs(clubCol('exercises'))) {
    exercises.push({ exercise, diagrams: await docs(clubCol('exercises', exercise.id, 'diagrams')) });
  }
  const trainings = await docs(clubCol('trainings'));
  const counters = await docs(clubCol('counters'));

  onProgress('Guides and access');
  return {
    club,
    members,
    acceptances,
    statusLog,
    teams,
    exercises,
    trainings,
    counters,
    skillGuide: await one(clubDoc('config', 'skillGuide')),
    physicalTestGuide: await one(clubDoc('config', 'physicalTestGuide')),
    sectionAccess: await docs(clubCol('sectionAccess')),
  };
}
