import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
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
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
      loading: false,
      authError: null,
    });
  });

  it('shows an access message instead of loading forever when the read is rejected', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });

    render(
      <MemoryRouter initialEntries={['/teams/team-1']}>
        <Routes>
          <Route path="/teams/:teamId" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this team.");
    expect(screen.queryByText('Loading team...')).not.toBeInTheDocument();
  });

  it('shows the team calendar when the Calendar tab is selected', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    fireEvent.click(await screen.findByText('Calendar'));

    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
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
