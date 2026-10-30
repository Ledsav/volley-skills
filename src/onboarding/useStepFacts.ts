import { useEffect, useState } from 'react';
import { hasAnySession } from '../calendar/calendarApi';
import { countClubMembers } from '../clubs/clubsApi';
import { hasAnyMatch } from '../matches/matchesApi';
import { getTeamSummary } from '../teams/teamsApi';
import type { Team } from '../types/team';
import type { StepFacts, StepId } from './steps';

/** Runs a check; a throw or rejection becomes the fallback. */
const settle = <T,>(run: () => Promise<T> | T, fallback: T): Promise<T> => Promise.resolve().then(run).catch(() => fallback);

/**
 * What the Get started steps need to know, read from real data: `limit(1)` per team, a team summary
 * and one members count, only for the requested steps. A failed read counts as not done.
 * Returns null until every check has settled, and runs nothing while `enabled` is false.
 */
export function useStepFacts(teams: Team[], steps: StepId[], enabled: boolean): StepFacts | null {
  const key = `${teams.map((t) => t.id).join(',')}|${steps.join(',')}`;
  const [result, setResult] = useState<{ key: string; facts: StepFacts } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const ids = key.split('|')[0].split(',').filter(Boolean);
    const wants = (s: StepId) => steps.includes(s);
    void Promise.all([
      wants('players') ? Promise.all(ids.map((id) => settle(async () => (await getTeamSummary(id)).players > 0, false))) : [],
      wants('coach') ? settle(() => countClubMembers(), 0) : 0,
      wants('session') ? Promise.all(ids.map((id) => settle(async () => !!(await hasAnySession(id)), false))) : [],
      wants('match') ? Promise.all(ids.map((id) => settle(async () => !!(await hasAnyMatch(id)), false))) : [],
    ]).then(([players, members, sessions, matches]) => {
      if (!live) return;
      setResult({
        key,
        facts: {
          teams: ids.length,
          anyPlayers: players.some(Boolean),
          members,
          anySession: sessions.some(Boolean),
          anyMatch: matches.some(Boolean),
        },
      });
    });
    return () => {
      live = false;
    };
    // `steps` is represented by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return enabled && result?.key === key ? result.facts : null;
}
