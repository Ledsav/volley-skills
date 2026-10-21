import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';
import { NoticeProvider } from '../components/Notice';

vi.mock('./teamsApi');
vi.mock('../players/playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../calendar/calendarApi', () => ({
  listCalendarSessions: vi.fn().mockResolvedValue([]),
  createCalendarSession: vi.fn(),
  deleteCalendarSession: vi.fn(),
}));

vi.mock('../matches/matchesApi', () => ({
  listMatches: vi.fn().mockResolvedValue({ matches: [], lastDoc: null, hasMore: false }),
  listMatchesInRange: vi.fn().mockResolvedValue([]),
}));

const team: Team = {
  id: 'team-1',
  name: 'U17 Boys',
  ageGroup: 'U17',
  season: '2026',
  description: 'Regional squad',
  notes: '',
  adminEmails: [],
  developmentPlan: { goals: [], focusAreas: [], notes: '' } as unknown as Team['developmentPlan'],
  createdBy: 'coach-uid',
  createdAt: null,
};

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

function renderTeamPage(url = '/teams/team-1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <NoticeProvider>
        <Routes>
          <Route path="/teams/:teamId" element={<><TeamPage /><LocationProbe /></>} />
        </Routes>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
  });

  it('shows the not-found state when the team cannot be read', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    renderTeamPage();
    expect(await screen.findByRole('heading', { name: 'Team not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/teams');
    expect(screen.queryByText('Loading team...')).not.toBeInTheDocument();
  });

  it('shows a retryable error (not not-found) when the team load fails transiently', async () => {
    const spy = vi.spyOn(teamsApi, 'getTeam').mockRejectedValueOnce({ code: 'unavailable' });
    spy.mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByText('Could not load this team.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Team not found' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'U17 Boys' })).toBeInTheDocument();
  });

  it('opens the tab named in ?tab= and updates the URL on tab change, dropping stats filters', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=stats&comp=cup&range=last5');
    expect(await screen.findByRole('tab', { name: 'Stats', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }));
    expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=matches');
  });

  it('falls back to Roster for ?tab=stats when not a team admin', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=stats');
    expect(await screen.findByRole('tab', { name: 'Roster', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('maps the old ?tab= ids onto the renamed tabs', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=overview');
    expect(await screen.findByRole('tab', { name: 'Roster', selected: true })).toBeInTheDocument();
  });

  it('orders the tabs by how often a coach uses them, Settings last', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('tab', { name: 'Roster' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Roster', 'Calendar', 'Matches', 'Stats', 'Development plan', 'Physical testing', 'Settings',
    ]);
  });

  it('shows the team calendar when the Calendar tab is selected', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'Calendar' }));

    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
  });

  it('switches sections from the mobile section picker', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    const picker = await screen.findByRole('combobox', { name: 'Team section' });
    expect(picker).toHaveValue('roster');
    expect(picker.parentElement?.className).toContain('sm:hidden');

    fireEvent.change(picker, { target: { value: 'calendar' } });

    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('tightens the page chrome and stacks the roster action buttons on mobile', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    const { container } = renderTeamPage();
    const addBtn = await screen.findByRole('button', { name: '+ Add player' });

    const page = container.firstChild as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    // The title sits on the canvas, not inside a card that would nest the tabs' own cards.
    const heading = screen.getByRole('heading', { name: 'U17 Boys' });
    expect(heading.closest('.shadow-card')).toBeNull();

    const actions = addBtn.parentElement as HTMLElement;
    expect(actions.className).toMatch(/(^|\s)grid-cols-2(\s|$)/);
    expect(actions.className).toContain('sm:flex');
  });

  it('hides the Calendar tab when the user has no trainings access', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue()); // member, no sections
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByRole('tab', { name: 'Calendar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Calendar' })).not.toBeInTheDocument();
  });

  it('shows the Calendar tab with trainings access', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isClubAdmin: false, sections: { exercises: false, trainings: true, guides: false } } })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('opens the player bulk-import dialog from the roster tab', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Import players' }));

    expect(screen.getByRole('dialog', { name: 'Import players' })).toBeInTheDocument();
    expect(screen.getByText(/consent not given/i)).toBeInTheDocument();
  });

  it('shows a consent-reminder notice after a successful player import', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    vi.spyOn(playersApi, 'bulkCreatePlayers').mockResolvedValue(2);

    renderTeamPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Import players' }));
    fireEvent.change(screen.getByLabelText('Paste JSON'), {
      target: {
        value: JSON.stringify([
          { number: 7, fullName: 'Ana Ruiz' },
          { number: 9, fullName: 'Bea Soto' },
        ]),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/imported 2 players with consent not given/i)
    );
    expect(playersApi.bulkCreatePlayers).toHaveBeenCalledTimes(1);
  });

  it('shows the Stats tab only to team admins', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['user@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  });

  it('hides the Stats tab for viewers', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['someone@else.be'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('tab', { name: 'Roster' });
    expect(screen.queryByRole('tab', { name: 'Stats' })).toBeNull();
  });
});
