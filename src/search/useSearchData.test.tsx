import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Access } from '../auth/access';
import { clearSearchData, useSearchData } from './useSearchData';

const auth = vi.hoisted(() => ({
  value: {} as { activeClubId: string; access: Access; appUser: { email: string } },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth.value }));
vi.mock('../teams/teamsApi', () => ({ listClubTeams: vi.fn(), listMyTeams: vi.fn() }));
vi.mock('../matches/matchesApi', () => ({ loadTeamRoster: vi.fn(), listMatches: vi.fn() }));

import { listMatches, loadTeamRoster } from '../matches/matchesApi';
import { listClubTeams, listMyTeams } from '../teams/teamsApi';

const team = (n: number) => ({ id: `t${n}`, name: `Team ${n}`, ageGroup: 'U17', season: '2026-27', adminEmails: [] });
const teamsPage = (n: number) => ({ teams: Array.from({ length: n }, (_, i) => team(i + 1)), lastDoc: null, hasMore: false });
const admin: Access = { isClubAdmin: true, sections: { exercises: true, trainings: true, guides: true } };
const member: Access = { isClubAdmin: false, sections: { exercises: false, trainings: false, guides: false } };

function setAuth(access: Access, clubId = 'c1') {
  auth.value = { activeClubId: clubId, access, appUser: { email: 'me@x.org' } };
}

describe('useSearchData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchData();
    setAuth(admin);
    vi.mocked(listClubTeams).mockResolvedValue(teamsPage(2) as never);
    vi.mocked(listMyTeams).mockResolvedValue(teamsPage(1) as never);
    vi.mocked(loadTeamRoster).mockImplementation((async () => [{ id: 'p1', fullName: 'Anna Rossi', number: 7 }]) as never);
    vi.mocked(listMatches).mockResolvedValue({ matches: [{ id: 'm1', opponent: 'Volley Rivals', date: '2026-11-02' }], lastDoc: null, hasMore: false } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it('loads teams once on first open, players and matches on first typed char', async () => {
    const { result, rerender } = renderHook((p: { opened: boolean; typed: boolean }) => useSearchData(p), { initialProps: { opened: false, typed: false } });
    expect(listClubTeams).not.toHaveBeenCalled();
    rerender({ opened: true, typed: false });
    await waitFor(() => expect(result.current.teams).toHaveLength(2));
    expect(result.current.teams[0]).toMatchObject({ label: 'Team 1', sublabel: 'U17 · 2026-27', to: '/teams/t1', keywords: ['U17'] });
    expect(loadTeamRoster).not.toHaveBeenCalled();
    rerender({ opened: true, typed: true });
    await waitFor(() => expect(result.current.players).toHaveLength(2));
    expect(result.current.players[0]).toMatchObject({ label: 'Anna Rossi', sublabel: 'Team 1', keywords: ['#7'], to: '/teams/t1/players/p1' });
    expect(result.current.matches[0]).toMatchObject({ label: 'vs Volley Rivals', to: '/teams/t1/matches/m1' });
    expect(result.current.matches[0].sublabel).toContain('Team 1');
    await waitFor(() => expect(result.current.loading.players).toBe(false));
    rerender({ opened: true, typed: false });
    rerender({ opened: true, typed: true });
    expect(listClubTeams).toHaveBeenCalledTimes(1);
    expect(loadTeamRoster).toHaveBeenCalledTimes(2);
  });

  it('club admin uses listClubTeams, member uses listMyTeams', async () => {
    const a = renderHook(() => useSearchData({ opened: true, typed: false }));
    await waitFor(() => expect(a.result.current.teams.length).toBeGreaterThan(0));
    expect(listClubTeams).toHaveBeenCalledTimes(1);
    expect(listMyTeams).not.toHaveBeenCalled();
    a.unmount();
    clearSearchData();
    setAuth(member);
    const m = renderHook(() => useSearchData({ opened: true, typed: false }));
    await waitFor(() => expect(m.result.current.teams).toHaveLength(1));
    expect(listMyTeams).toHaveBeenCalledWith('me@x.org');
  });

  it('caps rosters and matches at the first 20 teams', async () => {
    vi.mocked(listClubTeams).mockResolvedValue(teamsPage(25) as never);
    const { result } = renderHook(() => useSearchData({ opened: true, typed: true }));
    await waitFor(() => expect(result.current.players.length).toBe(20));
    await waitFor(() => expect(result.current.loading.players).toBe(false));
    expect(loadTeamRoster).toHaveBeenCalledTimes(20);
    expect(listMatches).toHaveBeenCalledTimes(20);
  });

  it('late roster load renders against the current query', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    vi.mocked(loadTeamRoster).mockImplementation((async (id: string) => {
      if (id === 't2') await gate;
      return [{ id: `p-${id}`, fullName: `Player ${id}`, number: 1 }];
    }) as never);
    const { result } = renderHook(() => useSearchData({ opened: true, typed: true }));
    await waitFor(() => expect(result.current.players).toHaveLength(1));
    expect(result.current.loading.players).toBe(true);
    await act(async () => release());
    await waitFor(() => expect(result.current.players.map((p) => p.label)).toEqual(['Player t1', 'Player t2']));
    await waitFor(() => expect(result.current.loading.players).toBe(false));
  });

  it('a failed load leaves the group empty and logs', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(loadTeamRoster).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSearchData({ opened: true, typed: true }));
    await waitFor(() => expect(result.current.loading.players).toBe(false));
    expect(result.current.players).toEqual([]);
    expect(result.current.matches).toHaveLength(2);
    expect(err).toHaveBeenCalled();
  });

  it('a failed teams load is retried on the next open, not cached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listClubTeams).mockRejectedValueOnce(new Error('offline'));
    const first = renderHook(() => useSearchData({ opened: true, typed: false }));
    await waitFor(() => expect(listClubTeams).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(first.result.current.loading.teams).toBe(false));
    expect(first.result.current.teams).toEqual([]);
    first.unmount();
    const second = renderHook(() => useSearchData({ opened: true, typed: false }));
    await waitFor(() => expect(second.result.current.teams).toHaveLength(2));
    expect(listClubTeams).toHaveBeenCalledTimes(2);
  });

  it('a failed teams load ends the Players and Matches skeletons', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(listClubTeams).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSearchData({ opened: true, typed: true }));
    await waitFor(() => expect(listClubTeams).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loading.teams).toBe(false));
    expect(result.current.loading.players).toBe(false);
    expect(result.current.loading.matches).toBe(false);
  });

  it('cache is keyed by club id and cleared on sign-out', async () => {
    const { result, rerender } = renderHook(() => useSearchData({ opened: true, typed: false }));
    await waitFor(() => expect(result.current.teams).toHaveLength(2));
    setAuth(admin, 'c2');
    vi.mocked(listClubTeams).mockResolvedValue(teamsPage(1) as never);
    rerender();
    expect(result.current.teams).toEqual([]);
    await waitFor(() => expect(result.current.teams).toHaveLength(1));
    expect(listClubTeams).toHaveBeenCalledTimes(2);
    act(() => clearSearchData());
    expect(result.current.teams).toEqual([]);
  });
});
