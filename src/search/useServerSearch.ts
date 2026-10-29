import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { searchExercises } from '../exercises/exercisesApi';
import { useT } from '../i18n/I18nProvider';
import { searchTrainings } from '../trainings/trainingsApi';
import type { Exercise } from '../types/exercise';
import type { Training } from '../types/training';
import { matchRank } from './match';
import { words } from './normalize';
import type { SearchItem } from './types';

const DEBOUNCE_MS = 300;
const SHOWN = 5;
const MAX_TOKEN = 12;

export interface ServerGroupState {
  items: SearchItem[];
  loading: boolean;
  hasMore: boolean;
  showMore: () => void;
}

interface Page<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/** The longest typed word, cut to the 12-character prefix the index holds; null under 2 characters. */
export function serverToken(query: string): string | null {
  let best = '';
  for (const w of words(query)) {
    const word = w.replace(/#/g, '');
    if (word.length > best.length) best = word;
  }
  const token = best.slice(0, MAX_TOKEN);
  return token.length >= 2 ? token : null;
}

interface Slot {
  /** Every client-side match fetched so far. */
  matched: SearchItem[];
  /** How many of them are shown; the first few until "Show more". */
  shown: number;
  loading: boolean;
  serverMore: boolean;
}
const EMPTY: Slot = { matched: [], shown: SHOWN, loading: false, serverMore: false };

function useGroup<T>(
  query: string,
  token: string | null,
  active: boolean,
  fetchPage: (token: string, after: QueryDocumentSnapshot | null) => Promise<Page<T>>,
  toItem: (row: T) => SearchItem,
): ServerGroupState {
  const [slot, setSlot] = useState<Slot>(EMPTY);
  // A request id per group: a response for an older query is dropped.
  const reqId = useRef(0);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const fetching = useRef(false);
  const toItemRef = useRef(toItem);
  toItemRef.current = toItem;
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const run = useCallback(
    (after: QueryDocumentSnapshot | null, id: number) => {
      fetching.current = true;
      fetchRef
        .current(token as string, after)
        .then((page) => {
          if (id !== reqId.current) return;
          fetching.current = false;
          cursor.current = page.lastDoc;
          const more = page.items.map((r) => toItemRef.current(r)).filter((i) => matchRank(query, i) !== null);
          setSlot((s) => ({ ...s, matched: after ? [...s.matched, ...more] : more, loading: false, serverMore: page.hasMore }));
        })
        .catch((e) => {
          if (id !== reqId.current) return;
          fetching.current = false;
          console.error('Server search failed', e);
          setSlot((s) => ({ ...s, matched: after ? s.matched : [], loading: false, serverMore: false }));
        });
    },
    [query, token],
  );

  useEffect(() => {
    const id = ++reqId.current;
    cursor.current = null;
    fetching.current = false;
    if (!active || token === null) {
      setSlot(EMPTY);
      return;
    }
    setSlot({ ...EMPTY, loading: true });
    const timer = setTimeout(() => run(null, id), DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      // Whatever is in flight for this query is now stale.
      reqId.current++;
    };
  }, [active, token, run]);

  const serverMore = slot.serverMore;
  const showMore = useCallback(() => {
    setSlot((s) => ({ ...s, shown: Number.POSITIVE_INFINITY }));
    if (serverMore && !fetching.current) run(cursor.current, reqId.current);
  }, [run, serverMore]);

  return {
    items: slot.matched.slice(0, slot.shown),
    loading: slot.loading,
    hasMore: slot.serverMore || slot.matched.length > slot.shown,
    showMore,
  };
}

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/** Debounced exercise and training search against the `searchTokens` indexes. */
export function useServerSearch(
  query: string,
  enabled: { exercises: boolean; trainings: boolean },
): { exercises: ServerGroupState; trainings: ServerGroupState; offline: boolean } {
  const t = useT();
  const online = useOnline();
  const token = serverToken(query);

  const exercises = useGroup<Exercise>(query, token, enabled.exercises && online, searchExercises, (e) => ({
    id: e.id,
    group: 'exercises',
    label: e.name,
    sublabel: t.labels.exerciseCategory[e.category],
    to: `/exercises?exercise=${e.id}`,
  }));
  const trainings = useGroup<Training>(query, token, enabled.trainings && online, searchTrainings, (tr) => ({
    id: tr.id,
    group: 'trainings',
    label: tr.name,
    sublabel: tr.businessId,
    keywords: [tr.businessId],
    to: `/trainings?training=${tr.id}`,
  }));

  return { exercises, trainings, offline: !online };
}
