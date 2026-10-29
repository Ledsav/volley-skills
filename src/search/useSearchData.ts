import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getT } from '../i18n/I18nProvider';
import { formatDate } from '../i18n/format';
import { loadTeamRoster, listMatches } from '../matches/matchesApi';
import { listClubTeams, listMyTeams } from '../teams/teamsApi';
import type { Team } from '../types/team';
import { searchKey } from './recents';
import type { SearchItem } from './types';

const MAX_TEAMS = 20;
const IN_FLIGHT = 4;

/** `failed` is not cached: the next open or typed character retries. */
type Status = 'idle' | 'loading' | 'done' | 'failed';

interface Store {
  key: string;
  teams: SearchItem[];
  players: SearchItem[];
  matches: SearchItem[];
  teamsStatus: Status;
  detailStatus: Status;
  teamList: Team[];
}

const emptyStore = (key: string): Store => ({ key, teams: [], players: [], matches: [], teamsStatus: 'idle', detailStatus: 'idle', teamList: [] });

// Session cache: one store for the active club + person; a different key discards it.
let store: Store = emptyStore('');
let generation = 0;
const listeners = new Set<() => void>();

function update(patch: Partial<Store>): void {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Forget every cached team, player and match (sign-out). */
export function clearSearchData(): void {
  generation++;
  store = emptyStore('');
  listeners.forEach((l) => l());
}

function reset(key: string): void {
  generation++;
  store = emptyStore(key);
  listeners.forEach((l) => l());
}

function teamItem(team: Team): SearchItem {
  return {
    id: team.id,
    group: 'teams',
    label: team.name,
    sublabel: [team.ageGroup, team.season].filter(Boolean).join(' · '),
    keywords: team.ageGroup ? [team.ageGroup] : [],
    to: `/teams/${team.id}`,
  };
}

async function loadTeams(isClubAdmin: boolean, email: string): Promise<void> {
  const gen = generation;
  update({ teamsStatus: 'loading' });
  try {
    const teams = (isClubAdmin ? await listClubTeams() : await listMyTeams(email)).teams;
    if (gen !== generation) return;
    update({ teams: teams.map(teamItem), teamList: teams, teamsStatus: 'done' });
  } catch (error) {
    console.error('Search: could not load teams', error);
    // Not cached: the next open or typed character tries again.
    if (gen === generation) update({ teamsStatus: 'failed' });
  }
}

async function loadDetail(): Promise<void> {
  const gen = generation;
  const teams = store.teamList.slice(0, MAX_TEAMS);
  let failed = false;
  update({ detailStatus: 'loading', players: [], matches: [] });
  const queue = [...teams];
  const t = getT();
  const worker = async () => {
    for (let team = queue.shift(); team; team = queue.shift()) {
      const [players, matches] = await Promise.all([
        loadTeamRoster(team.id).catch((e) => {
          failed = true;
          console.error('Search: could not load players', e);
          return [];
        }),
        listMatches(team.id)
          .then((p) => p.matches)
          .catch((e) => {
            failed = true;
            console.error('Search: could not load matches', e);
            return [];
          }),
      ]);
      if (gen !== generation) return;
      const owner = team;
      update({
        players: [
          ...store.players,
          ...players.map<SearchItem>((p) => ({
            id: `${owner.id}/${p.id}`,
            group: 'players',
            label: p.fullName,
            sublabel: owner.name,
            keywords: [`#${p.number}`],
            to: `/teams/${owner.id}/players/${p.id}`,
          })),
        ],
        matches: [
          ...store.matches,
          ...matches.map<SearchItem>((m) => {
            const date = formatDate(m.date, 'short');
            return {
              id: `${owner.id}/${m.id}`,
              group: 'matches',
              label: t.search.versus(m.opponent),
              sublabel: `${date} · ${owner.name}`,
              keywords: [m.opponent, m.date, date],
              to: `/teams/${owner.id}/matches/${m.id}`,
            };
          }),
        ],
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(IN_FLIGHT, teams.length) }, worker));
  if (gen !== generation) return;
  update({ detailStatus: failed ? 'failed' : 'done' });
}

export interface SearchData {
  teams: SearchItem[];
  players: SearchItem[];
  matches: SearchItem[];
  loading: { teams: boolean; players: boolean; matches: boolean };
}

/** Teams on first open, players and matches on the first typed character; cached for the session. */
export function useSearchData({ opened, typed }: { opened: boolean; typed: boolean }): SearchData {
  const { activeClubId, access, appUser } = useAuth();
  const email = appUser?.email ?? '';
  const key = searchKey(activeClubId, email);
  const snapshot = useSyncExternalStore(subscribe, () => store);
  const current = snapshot.key === key ? snapshot : emptyStore(key);
  const isClubAdmin = !!access?.isClubAdmin;

  useEffect(() => {
    if (store.key !== key) reset(key);
  }, [key]);

  const wantTeams = (opened || typed) && !!activeClubId && !!email;
  useEffect(() => {
    if (wantTeams && store.key === key && store.teamsStatus === 'idle') void loadTeams(isClubAdmin, email);
  }, [wantTeams, key, isClubAdmin, email, snapshot.key, snapshot.teamsStatus]);

  // A failed load is retried when the palette is opened again or a character is typed, never in a loop.
  useEffect(() => {
    if (wantTeams && store.key === key && store.teamsStatus === 'failed') void loadTeams(isClubAdmin, email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantTeams, typed, key]);

  useEffect(() => {
    if (typed && store.key === key && store.teamsStatus === 'done' && store.detailStatus === 'failed') void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, key]);

  useEffect(() => {
    if (typed && store.key === key && store.teamsStatus === 'done' && store.detailStatus === 'idle') void loadDetail();
  }, [typed, key, snapshot.key, snapshot.teamsStatus, snapshot.detailStatus]);

  const detailPending = typed && current.teamsStatus !== 'failed' && (current.detailStatus === 'idle' || current.detailStatus === 'loading');
  return {
    teams: current.teams,
    players: current.players,
    matches: current.matches,
    loading: { teams: current.teamsStatus === 'loading', players: detailPending, matches: detailPending },
  };
}
