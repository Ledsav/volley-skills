import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue } from '../test/authValue';
import { DEFAULT_FORMAT, type Match } from '../types/match';
import type { Team } from '../types/team';
import { finished, player } from '../awards/testMatches';
import { HomePage } from './HomePage';
import * as teamsApi from '../teams/teamsApi';
import * as calendarApi from '../calendar/calendarApi';
import * as matchesApi from '../matches/matchesApi';

vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../teams/teamsApi');
vi.mock('../calendar/calendarApi');
vi.mock('../matches/matchesApi');
const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const team: Team = {
  id: 't1', name: 'U17 Girls', club: 'VCB', ageGroup: 'U17', season: '2026-27', description: '', notes: '',
  adminEmails: ['user@example.com'], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
};
const live: Match = {
  id: 'm1', date: '2026-10-14', opponent: 'Rivals', competition: 'league', homeAway: 'home', format: DEFAULT_FORMAT, roster: [], liberos: [],
  status: 'live', result: { setsUs: 1, setsThem: 0, sets: [] }, summary: null, usageContribution: null, activeDevice: null, createdBy: '', createdAt: null, updatedAt: null,
};

function renderHome() {
  render(<MemoryRouter><HomePage /></MemoryRouter>);
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 18, 0));
    useAuthMock.mockReturnValue(authValue());
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });
    vi.mocked(calendarApi.listCalendarSessions).mockResolvedValue([]);
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([live]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('greets and shows a live match to resume', async () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: /Good evening/ })).toBeInTheDocument();
    const resume = await screen.findByRole('link', { name: /Resume scouting/ });
    expect(resume).toHaveAttribute('href', '/teams/t1/matches/m1/scout');
  });

  it('shows the no-access card when the user has no teams or sections', async () => {
    vi.mocked(teamsApi.listMyTeams).mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
    renderHome();
    expect(await screen.findByText("You don't have access to any team yet")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request access' })).toHaveAttribute('href', '/request-access');
  });

  it('a failing calendar does not hide matches', async () => {
    vi.mocked(calendarApi.listCalendarSessions).mockRejectedValue(new Error('x'));
    renderHome();
    expect(await screen.findByText('Could not load upcoming sessions.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Resume scouting/ })).toBeInTheDocument();
  });

  it('recent results show the MVP', async () => {
    vi.mocked(matchesApi.listMatchesInRange).mockResolvedValue([finished('m9', '2026-10-12', [player('a', { A: '###' })])]);
    renderHome();
    const mvp = await screen.findByText('MVP: #1 Player a.');
    expect(mvp.closest('a')).toHaveAttribute('href', expect.stringMatching(/\/teams\/[^/]+\/matches\/m9\/awards$/));
    expect(mvp.closest('a')!.parentElement!.querySelectorAll('a a')).toHaveLength(0);
  });
});
