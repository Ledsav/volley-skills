import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import type { Team } from '../types/team';
import * as teamsApi from '../teams/teamsApi';
import * as matchesApi from '../matches/matchesApi';
import * as awardsApi from './awardsApi';
import { finished, player } from './testMatches';
import AwardsPage from './AwardsPage';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../teams/teamsApi');
vi.mock('./awardsApi');
vi.mock('../matches/matchesApi', async (orig) => ({
  ...(await orig<typeof import('../matches/matchesApi')>()),
  getMatch: vi.fn(), listFinishedMatches: vi.fn(), loadTeamRoster: vi.fn(),
}));
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const team = { id: 't1', name: 'U17 Girls', season: '2026-27', adminEmails: ['user@example.com'] } as unknown as Team;
const m = finished('m1', '2026-10-12', [player('a', { A: '########' })]);

function renderAt(path: string, scope: 'season' | 'match') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/teams/:teamId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId/matches/:matchId/awards" element={<AwardsPage scope={scope} />} />
        <Route path="/teams/:teamId" element={<p>team page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AwardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(authValue());
    vi.mocked(teamsApi.getTeam).mockResolvedValue(team);
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([m]);
    vi.mocked(matchesApi.getMatch).mockResolvedValue(m);
    vi.mocked(matchesApi.loadTeamRoster).mockResolvedValue([]);
    vi.mocked(awardsApi.getSeasonAwards).mockResolvedValue(null);
    vi.mocked(awardsApi.saveSeasonAwards).mockResolvedValue();
    vi.mocked(awardsApi.saveMatchAwards).mockResolvedValue();
  });

  it('season: loads, shows awards, saves an override (debounced)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderAt('/teams/t1/awards', 'season');
    const row = await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.change(row.querySelector('select')!, { target: { value: 'a' } });
    await vi.advanceTimersByTimeAsync(900);
    expect(awardsApi.saveSeasonAwards).toHaveBeenCalledWith('t1', expect.objectContaining({ picks: { attacker: { playerId: 'a', hidden: false } } }), 'u-1');
    vi.useRealTimers();
  });

  it('match: unfinished match shows a message', async () => {
    vi.mocked(matchesApi.getMatch).mockResolvedValue({ ...m, status: 'live' });
    renderAt('/teams/t1/matches/m1/awards', 'match');
    expect(await screen.findByText('Awards are available once the match is finished.')).toBeInTheDocument();
  });

  it('non-admins get not-found', async () => {
    vi.mocked(teamsApi.getTeam).mockResolvedValue({ ...team, adminEmails: ['other@x.be'] });
    renderAt('/teams/t1/awards', 'season');
    expect(await screen.findByRole('heading', { name: 'Awards not found' })).toBeInTheDocument();
  });

  it('Present switches to the ceremony and Escape returns', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    renderAt('/teams/t1/awards', 'season');
    await screen.findByRole('region', { name: 'Best attacker' });
    fireEvent.click(screen.getByRole('button', { name: /Present/ }));
    expect(screen.getByRole('button', { name: 'Exit presentation' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByRole('region', { name: 'Best attacker' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
