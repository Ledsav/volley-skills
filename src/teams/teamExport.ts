import { downloadJson, fileSlug, toExportable } from '../export/exportJson';

type Doc = Record<string, unknown> & { id: string };

/** Raw team data as read from Firestore, before it is made plain JSON. */
export interface TeamExportData {
  team: Doc;
  players: { player: Doc; physicalTests: Doc[] }[];
  testingSessions: { session: Doc; entries: Doc[] }[];
  /** `events` is null when raw scouting events were not requested. */
  matches: { match: Doc; events: Doc[] | null }[];
  /** null when the exporter has no trainings access (the calendar is not readable). */
  calendar: Doc[] | null;
  scoutProfile: Doc[];
}

export interface TeamExportOptions {
  includeEvents: boolean;
  includeCalendar: boolean;
}

export interface TeamExport {
  exportedAt: string;
  notes: string[];
  team: unknown;
  players: unknown;
  testingSessions: unknown;
  matches: unknown;
  calendar: unknown;
  scoutProfile: unknown;
}

export function buildTeamExport(data: TeamExportData, now: Date = new Date()): TeamExport {
  const notes: string[] = [];
  if (data.matches.some((m) => m.events === null)) {
    notes.push("Raw scouting events are not included; each finished match's report holds its computed stats.");
  }
  if (data.calendar === null) notes.push('Calendar not included: the exporter has no trainings access.');
  return {
    exportedAt: now.toISOString(),
    notes,
    team: toExportable(data.team),
    players: toExportable(data.players),
    testingSessions: toExportable(data.testingSessions),
    matches: toExportable(data.matches.map((m) => (m.events === null ? { match: m.match } : m))),
    calendar: toExportable(data.calendar),
    scoutProfile: toExportable(data.scoutProfile),
  };
}

export function downloadTeamExport(data: TeamExportData): void {
  const payload = buildTeamExport(data);
  const name = typeof data.team.name === 'string' ? data.team.name : data.team.id;
  downloadJson(`team-${fileSlug(name)}-${payload.exportedAt.slice(0, 10)}.json`, payload);
}
