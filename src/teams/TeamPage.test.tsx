import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';

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
  club: 'VC',
  ageGroup: 'U17',
  season: '2026',
  description: 'Regional squad',
  notes: '',
  adminEmails: [],
  developmentPlan: { goals: [], focusAreas: [], notes: '' } as unknown as Team['developmentPlan'],
  createdBy: 'coach-uid',
  createdAt: null,
};

function renderTeamPage() {
  return render(
    <MemoryRouter initialEntries={['/teams/team-1']}>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
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
    expect(picker).toHaveValue('overview');
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

    const innerCard = screen.getByRole('heading', { name: 'U17 Boys' }).parentElement as HTMLElement;
    expect(innerCard.className).toContain('p-4');
    expect(innerCard.className).toContain('sm:p-6');

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
      authValue({ access: { isSuperAdmin: false, sections: { exercises: false, trainings: true, guides: false } } })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('opens the player bulk-import dialog from the overview tab', async () => {
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

    expect(
      await screen.findByText(/imported 2 players with consent not given/i)
    ).toBeInTheDocument();
    expect(playersApi.bulkCreatePlayers).toHaveBeenCalledTimes(1);
  });
});
