import type { CalendarSession } from '../types/calendarSession';
import type { Match } from '../types/match';
import type { Team } from '../types/team';

export interface FeedInput { team: Team; sessions: CalendarSession[]; matches: Match[] }
export interface FeedMatch { team: Team; match: Match }
export type FeedItem =
  | { kind: 'session'; date: string; team: Team; session: CalendarSession }
  | { kind: 'match'; date: string; team: Team; match: Match };

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date, ISO "YYYY-MM-DD" (calendar dates are local, not UTC). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayIso(new Date(y, m - 1, d + n));
}

export function liveMatches(input: FeedInput[]): FeedMatch[] {
  return input.flatMap(({ team, matches }) => matches.filter((m) => m.status === 'live').map((match) => ({ team, match })));
}

export function nextUp(input: FeedInput[], today: string, days = 7): FeedItem[] {
  const end = addDays(today, days);
  const inWindow = (d: string) => d >= today && d <= end;
  const items: FeedItem[] = input.flatMap(({ team, sessions, matches }) => [
    ...sessions.filter((s) => inWindow(s.date)).map((session) => ({ kind: 'session' as const, date: session.date, team, session })),
    ...matches.filter((m) => m.status === 'setup' && inWindow(m.date)).map((match) => ({ kind: 'match' as const, date: match.date, team, match })),
  ]);
  return items.sort((a, b) => a.date.localeCompare(b.date) || a.team.name.localeCompare(b.team.name));
}

export function recentResults(input: FeedInput[], limit = 5): FeedMatch[] {
  return input
    .flatMap(({ team, matches }) => matches.filter((m) => m.status === 'finished').map((match) => ({ team, match })))
    .sort((a, b) => b.match.date.localeCompare(a.match.date))
    .slice(0, limit);
}
