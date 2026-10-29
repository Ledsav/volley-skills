import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { listAllTeams, type TeamRow } from '../../access/accessApi';

/** The club's teams, one page (50) at a time, with the cursor kept for Load more. */
export function useTeamPages() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<'load' | 'more' | null>(null);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    listAllTeams().then((page) => {
      if (!alive.current) return;
      cursor.current = page.lastDoc;
      setTeams(page.teams);
      setHasMore(page.hasMore);
    }).catch(() => {
      if (alive.current) setError('load');
    });
    return () => { alive.current = false; };
  }, []);

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await listAllTeams(cursor.current);
      if (!alive.current) return;
      cursor.current = page.lastDoc;
      setTeams((prev) => [...prev, ...page.teams]);
      setHasMore(page.hasMore);
    } catch {
      if (alive.current) setError('more');
    } finally {
      busy.current = false;
      if (alive.current) setLoadingMore(false);
    }
  }, []);

  return { teams, hasMore, loadingMore, error, loadMore };
}
