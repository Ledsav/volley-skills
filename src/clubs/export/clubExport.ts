import { strToU8, zipSync } from 'fflate';
import { fileSlug, toExportable } from '../../export/exportJson';
import { csvDocument, type Cell } from '../../matches/report/reportCsv';
import { POSITION_CATEGORIES, SKILL_KEYS } from '../../types/player';
import type { TeamExportData } from '../../teams/teamExport';
import { exportReadme } from './exportReadme';

export type ExportDoc = Record<string, unknown> & { id: string };

/** Everything a club stores, as read for the club export (spec §7.2). */
export interface ClubExportData {
  club: ExportDoc;
  members: ExportDoc[];
  acceptances: ExportDoc[];
  statusLog: ExportDoc[];
  /** Loaded with events and calendar, so neither is null here. */
  teams: { data: TeamExportData; awards: ExportDoc[] }[];
  exercises: { exercise: ExportDoc; diagrams: ExportDoc[] }[];
  trainings: ExportDoc[];
  counters: ExportDoc[];
  skillGuide: ExportDoc | null;
  physicalTestGuide: ExportDoc | null;
  sectionAccess: ExportDoc[];
}

const json = (value: unknown) => JSON.stringify(toExportable(value), null, 2);

const byOrder = (a: ExportDoc, b: ExportDoc) => Number(a.order ?? 0) - Number(b.order ?? 0);

/** The export as a `path → file text` map. Paths use document ids, never names. */
export function buildClubExportFiles(data: ClubExportData, now: Date = new Date()): Record<string, string> {
  const files: Record<string, string> = {
    'club.json': json(data.club),
    'members.json': json(data.members),
    'acceptances.json': json(data.acceptances),
    'statusLog.json': json(data.statusLog),
  };
  for (const { data: t, awards } of data.teams) {
    const dir = `teams/${t.team.id}`;
    files[`${dir}/team.json`] = json(t.team);
    files[`${dir}/players.json`] = json(t.players);
    files[`${dir}/players.csv`] = playersCsv(t.players);
    files[`${dir}/calendar.json`] = json(t.calendar ?? []);
    files[`${dir}/testingSessions.json`] = json(t.testingSessions);
    files[`${dir}/awards.json`] = json(awards);
    files[`${dir}/scoutProfile.json`] = json(t.scoutProfile);
    for (const { match, events } of t.matches) {
      files[`${dir}/matches/${match.id}.json`] = json({ match, events: [...(events ?? [])].sort(byOrder) });
    }
  }
  files['library/exercises.json'] = json(
    data.exercises.map(({ exercise, diagrams }) => ({ exercise, diagrams: [...diagrams].sort(byOrder) })),
  );
  files['library/trainings.json'] = json(data.trainings);
  files['library/counters.json'] = json(data.counters);
  files['config/skillGuide.json'] = json(data.skillGuide);
  files['config/physicalTestGuide.json'] = json(data.physicalTestGuide);
  files['sectionAccess.json'] = json(data.sectionAccess);
  files['README.txt'] = exportReadme(data.club, Object.keys(files), now);
  return files;
}

const SKILL_HEADERS: Record<(typeof SKILL_KEYS)[number], string> = {
  serve: 'Serve',
  attack: 'Attack',
  block: 'Block',
  set: 'Set',
  defence: 'Defence',
  reception: 'Reception',
  jump: 'Jump',
  speed: 'Speed',
  iq: 'IQ',
};

const HEADER: Cell[] = [
  'Number', 'Name', 'Date of birth', 'Nationality', 'Licence', 'Position', 'Shirt size', 'Starting',
  'Player phone', 'Guardians', 'Viewer emails', 'Average', 'Level',
  ...SKILL_KEYS.map((k) => SKILL_HEADERS[k]),
  'Consent given', 'Consent date', 'Left club',
];

type Raw = Record<string, unknown>;
const text = (v: unknown): Cell => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): Cell => (typeof v === 'number' ? v : null);
const yesNo = (v: unknown): Cell => (v === true ? 'yes' : 'no');

function guardiansCell(v: unknown): Cell {
  if (!Array.isArray(v) || v.length === 0) return null;
  return v
    .map((g: Raw) => `${g.relation ?? ''}: ${[g.name, g.phone, g.email].filter(Boolean).join(', ')}`)
    .join(' | ');
}

/** One row per player, sorted by shirt number; for spreadsheets (the JSON files are the full record). */
export function playersCsv(players: TeamExportData['players']): string {
  const rows = [...players]
    .map(({ player }) => player as Raw)
    .sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0))
    .map((p): Cell[] => {
      const skills = (p.skills ?? {}) as Record<string, { score?: unknown } | undefined>;
      const consent = (p.consent ?? {}) as Raw;
      const position = POSITION_CATEGORIES.find((c) => c.value === p.positionCategory)?.label ?? null;
      return [
        num(p.number), text(p.fullName), text(p.dob), text(p.nationality), text(p.licenseNumber),
        position, text(p.shirtSize), yesNo(p.starting), text(p.playerPhone), guardiansCell(p.guardians),
        Array.isArray(p.viewerEmails) && p.viewerEmails.length > 0 ? p.viewerEmails.join(', ') : null,
        num(p.avgScore), text(p.level),
        ...SKILL_KEYS.map((k) => num(skills[k]?.score)),
        yesNo(consent.given), text(consent.date), text(p.leftClubAt),
      ];
    });
  return csvDocument([HEADER, ...rows], 'en');
}

export function zipClubExport(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, body]) => [path, strToU8(body)])));
}

export function clubExportFileName(club: ExportDoc, now: Date): string {
  const name = typeof club.name === 'string' && club.name ? club.name : club.id;
  return `club-${fileSlug(name)}-export-${now.toISOString().slice(0, 10)}.zip`;
}
