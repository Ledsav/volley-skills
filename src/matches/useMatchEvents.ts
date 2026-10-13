import { useEffect, useState } from 'react';
import type { MatchEvent } from '../types/match';
import { subscribeEvents } from './matchesApi';

/** `enabled: false` skips the listener entirely — reading the event log is the
 *  most expensive read in the app, so only subscribe when it is needed. */
export function useMatchEvents(teamId: string, matchId: string, enabled = true) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return subscribeEvents(
      teamId,
      matchId,
      (next, pendingCount) => {
        setEvents(next);
        setPending(pendingCount);
      },
      () => setError('Could not load match events. Check your connection.'),
    );
  }, [teamId, matchId, enabled]);

  return { events, pending, error };
}
