import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Team } from '../types/team';
import { useStepFacts } from './useStepFacts';

const api = vi.hoisted(() => ({
  getTeamSummary: vi.fn(),
  countClubMembers: vi.fn(),
  hasAnySession: vi.fn(),
  hasAnyMatch: vi.fn(),
}));
vi.mock('../teams/teamsApi', () => ({ getTeamSummary: api.getTeamSummary }));
vi.mock('../clubs/clubsApi', () => ({ countClubMembers: api.countClubMembers }));
vi.mock('../calendar/calendarApi', () => ({ hasAnySession: api.hasAnySession }));
vi.mock('../matches/matchesApi', () => ({ hasAnyMatch: api.hasAnyMatch }));

const teams = [{ id: 'a' }, { id: 'b' }] as Team[];

describe('useStepFacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTeamSummary.mockResolvedValue({ players: 0, avgScore: null });
    api.countClubMembers.mockResolvedValue(1);
    api.hasAnySession.mockResolvedValue(false);
    api.hasAnyMatch.mockResolvedValue(false);
  });

  it('only queries what the steps need', async () => {
    const { result } = renderHook(() => useStepFacts(teams, ['session', 'match'], true));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(api.countClubMembers).not.toHaveBeenCalled();
    expect(api.getTeamSummary).not.toHaveBeenCalled();
    expect(api.hasAnySession).toHaveBeenCalledTimes(2);
    expect(api.hasAnyMatch).toHaveBeenCalledTimes(2);
  });

  it('reads players, members and the team count when asked', async () => {
    api.getTeamSummary.mockResolvedValueOnce({ players: 0, avgScore: null }).mockResolvedValueOnce({ players: 4, avgScore: 5 });
    api.countClubMembers.mockResolvedValue(3);
    const { result } = renderHook(() => useStepFacts(teams, ['team', 'players', 'coach'], true));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ teams: 2, anyPlayers: true, members: 3, anySession: false, anyMatch: false });
  });

  it('a rejecting team does not hide another team that has a session', async () => {
    api.hasAnySession.mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(true);
    const { result } = renderHook(() => useStepFacts(teams, ['session'], true));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.anySession).toBe(true);
  });

  it('counts every rejected check as not done, without throwing', async () => {
    for (const fn of Object.values(api)) fn.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useStepFacts(teams, ['players', 'coach', 'session', 'match'], true));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual({ teams: 2, anyPlayers: false, members: 0, anySession: false, anyMatch: false });
  });

  it('runs nothing and returns null when disabled', async () => {
    const { result } = renderHook(() => useStepFacts(teams, ['players', 'coach', 'session', 'match'], false));
    await Promise.resolve();
    expect(result.current).toBeNull();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });
});
