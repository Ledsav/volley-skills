import { useEffect, useState } from 'react';
import type { MatchEvent } from '../types/match';
import { subscribeEvents } from './matchesApi';

export function useMatchEvents(teamId: string, matchId: string) {
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeEvents(
      teamId,
      matchId,
      (next, pendingCount) => {
        setEvents(next);
        setPending(pendingCount);
      },
      () => setError('Could not load match events. Check your connection.'),
    );
  }, [teamId, matchId]);

  return { events, pending, error };
}
