import { useEffect, useState } from 'react';
import { listCalendarSessions } from '../calendar/calendarApi';
import { listMatchesInRange } from '../matches/matchesApi';
import { listMyTeams } from '../teams/teamsApi';
import type { Team } from '../types/team';
import { addDays, todayIso, type FeedInput } from './homeFeed';

export interface HomeFeedState {
  loading: boolean;
  today: string;
  teams: Team[];
  hasMoreTeams: boolean;
  feed: FeedInput[];
  errors: { teams: boolean; sessions: boolean; matches: boolean };
}

export function useHomeFeed(email: string | null): HomeFeedState {
  const [state, setState] = useState<HomeFeedState>({
    loading: true, today: todayIso(), teams: [], hasMoreTeams: false, feed: [], errors: { teams: false, sessions: false, matches: false },
  });

  useEffect(() => {
    if (!email) {
      setState((s) => (s.loading ? { ...s, loading: false } : s));
      return;
    }
    let cancelled = false;
    const today = todayIso();
    void (async () => {
      let teams: Team[] = [];
      let hasMoreTeams = false;
      try {
        const page = await listMyTeams(email);
        teams = page.teams;
        hasMoreTeams = page.hasMore;
      } catch {
        if (!cancelled) setState((s) => ({ ...s, loading: false, errors: { ...s.errors, teams: true } }));
        return;
      }
      let sessionsFailed = false;
      let matchesFailed = false;
      const feed = await Promise.all(
        teams.map(async (team): Promise<FeedInput> => {
          const [sessions, matches] = await Promise.all([
            listCalendarSessions(team.id, today, addDays(today, 7)).catch(() => {
              sessionsFailed = true;
              return [];
            }),
            listMatchesInRange(team.id, addDays(today, -30), addDays(today, 7)).catch(() => {
              matchesFailed = true;
              return [];
            }),
          ]);
          return { team, sessions, matches };
        }),
      );
      if (!cancelled) {
        setState({ loading: false, today, teams, hasMoreTeams, feed, errors: { teams: false, sessions: sessionsFailed, matches: matchesFailed } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email]);

  return state;
}
