import { fileSlug } from '../../export/exportJson';
import { csvDocument, type Cell, type CsvFormat } from '../../matches/report/reportCsv';
import type { Match } from '../../types/match';
import type { SkillKey } from '../../types/player';
import type { TeamPlayerRow } from './teamSeason';

const RATED: SkillKey[] = ['serve', 'reception', 'attack', 'block', 'set', 'defence'];

export function teamStatsCsv(rows: TeamPlayerRow[], format: CsvFormat = 'en'): string {
  const header: Cell[] = ['Number', 'Name', 'Matches', 'Points', 'Errors', 'MVP avg', 'Attack eff', 'Serve eff', 'Reception +', ...RATED.map((k) => `Rating ${k}`)];
  const body: Cell[][] = rows.map((r) => [
    r.number, r.name, r.matchesPlayed, r.points, r.errors, r.mvpAvg, r.attackEff, r.serveEff, r.receptionPos,
    ...RATED.map((k) => r.ratings[k]?.rating ?? null),
  ]);
  return csvDocument([header, ...body], format);
}

export function teamStatsCsvFileName(teamName: string, matches: Match[]): string {
  const dates = matches.map((m) => m.date).sort();
  const span = dates.length ? `${dates[0]}-${dates[dates.length - 1]}` : 'empty';
  return `${fileSlug(teamName)}-stats-${span}.csv`;
}
