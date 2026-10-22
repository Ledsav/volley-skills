import type { ExportDoc } from './clubExport';

// One line per file pattern. `<teamId>` and `<matchId>` stand for document ids.
const FILES: [string, string][] = [
  ['README.txt', 'This file.'],
  ['club.json', "The club's profile and contract status: name, country, language, settings (aiEnabled, growthTestsEnabled, referenceOptOut), status, termination dates and the accepted legal version."],
  ['members.json', 'Everyone with access to the club: email, role (admin or member), who added them and when.'],
  ['acceptances.json', 'Signed acceptances of the Terms and DPA: version, who accepted and when.'],
  ['statusLog.json', 'History of status changes (from, to, reason, by, at).'],
  ['teams/<teamId>/team.json', 'One team: name, age group, season, and adminEmails (the people who manage it).'],
  ['teams/<teamId>/players.json', 'Every player with their physical tests: profile, guardians, skills, development plan, consent.'],
  ['teams/<teamId>/players.csv', 'The same players as a spreadsheet, one row each (the JSON file is the full record).'],
  ['teams/<teamId>/calendar.json', 'Training calendar sessions.'],
  ['teams/<teamId>/testingSessions.json', 'Physical testing sessions with their entries.'],
  ['teams/<teamId>/awards.json', 'Season award choices made by the coaches.'],
  ['teams/<teamId>/scoutProfile.json', 'Scouting usage counters per player.'],
  ['teams/<teamId>/matches/<matchId>.json', 'One match and every scouting event, in recorded order (events sorted by "order").'],
  ['library/exercises.json', 'The exercise library, each with its court diagrams.'],
  ['library/trainings.json', 'Training sessions built from the library.'],
  ['library/counters.json', 'Counters used to number trainings.'],
  ['config/skillGuide.json', 'The skill guide text per score range (null if never set).'],
  ['config/physicalTestGuide.json', 'The physical test guide (null if never set).'],
  ['sectionAccess.json', 'Who manages the exercises, trainings and guides sections (adminEmails).'],
];

const FIELDS = [
  'skills: nine skills, each { score 1-10 or null, notes, priority }.',
  'avgScore: the average of the scored skills; level is derived from it (below 4 Beginner, below 6 Developing, below 8 Advanced, else Elite).',
  'viewerEmails: people allowed to see one player card (typically guardians).',
  'consent: { given, date, confirmedBy } for storing the player\'s data.',
  'leftClubAt: the date a player left the club (starts the retention clock).',
  'adminEmails: people who manage a team or section.',
];

/** README.txt for the club export: what each file is, field meanings and formats (Data Act information). */
export function exportReadme(club: ExportDoc, paths: string[], now: Date): string {
  const name = typeof club.name === 'string' ? club.name : club.id;
  const pattern = (p: string) =>
    p.replace(/^teams\/[^/]+\/matches\/[^/]+\.json$/, 'teams/<teamId>/matches/<matchId>.json').replace(/^teams\/[^/]+\//, 'teams/<teamId>/');
  const present = new Set(paths.map(pattern));
  present.add('README.txt');
  return [
    'Club data export',
    `Club: ${name} (${club.id})`,
    `Exported: ${now.toISOString()}`,
    '',
    'Formats',
    'JSON files are UTF-8. Timestamps are ISO 8601 in UTC; calendar and test dates are "YYYY-MM-DD".',
    'Every "id" is the stored document id. CSV files are comma-separated UTF-8 with a BOM (for Excel).',
    "This export contains minors' personal data. Keep it somewhere safe.",
    '',
    'Files',
    ...FILES.filter(([p]) => present.has(p)).map(([p, d]) => `${p}\n  ${d}`),
    '',
    'Fields',
    ...FIELDS,
    '',
  ].join('\n');
}
