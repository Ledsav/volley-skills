import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayerCardPage } from './PlayerCardPage';
import * as playersApi from './playersApi';
import * as teamsApi from '../teams/teamsApi';
import * as physicalTestsApi from './physicalTestsApi';
import * as footprintApi from './playerFootprintApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, superAdminAccess } from '../test/authValue';
import type { Player } from '../types/player';
import type { Team } from '../types/team';

const mockNavigate = vi.fn();

vi.mock('./playersApi');
vi.mock('../teams/teamsApi');
vi.mock('./physicalTestsApi');
vi.mock('./playerExport');
vi.mock('./playerFootprintApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseTeam: Team = {
  id: 'team-1',
  name: 'U17',
  club: 'VCB',
  ageGroup: 'U17',
  season: '2026-27',
  description: '',
  notes: '',
  adminEmails: ['coach@example.com'],
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  createdBy: 'coach-uid',
  createdAt: null,
};

const basePlayer: Player = {
  id: 'player-1',
  number: 7,
  fullName: 'Test Player',
  dob: '2012-01-01',
  nationality: 'BEL',
  licenseNumber: 'J-000001',
  positionCategory: 'OH',
  shirtSize: '',
  starting: false,
  playerPhone: '',
  guardians: [],
  viewerEmails: ['viewer@example.com'],
  teamName: 'U17',
  ageGroup: 'U17',
  season: '2026-27',
  skills: {
    serve: { score: null, notes: '', priority: false },
    attack: { score: null, notes: '', priority: false },
    block: { score: null, notes: '', priority: false },
    set: { score: null, notes: '', priority: false },
    defence: { score: null, notes: '', priority: false },
    reception: { score: null, notes: '', priority: false },
    jump: { score: null, notes: '', priority: false },
    speed: { score: null, notes: '', priority: false },
    iq: { score: null, notes: '', priority: false },
  },
  avgScore: null,
  level: null,
  developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
  consent: { given: true, date: '2026-09-07', confirmedBy: 'coach@example.com' },
  createdBy: 'coach-uid',
  createdAt: null,
  updatedAt: null,
};

function renderPlayerCard() {
  return render(
    <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
      <Routes>
        <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PlayerCardPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null, appUser: null }));
  });

  it('shows an access message instead of loading forever when the read is rejected', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(null);

    renderPlayerCard();

    expect(await screen.findByRole('alert')).toHaveTextContent("You don't have access to this player.");
    expect(screen.queryByText('Loading player...')).not.toBeInTheDocument();
  });

  it('renders the player card in read-only mode for a linked viewer whose team read is denied', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});

    renderPlayerCard();

    expect(await screen.findByText('Test Player')).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this player.")).not.toBeInTheDocument();
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete player')).not.toBeInTheDocument();
  });

  it('lets a team admin delete the player and navigates back to the team', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const deleteSpy = vi.spyOn(playersApi, 'deletePlayer').mockResolvedValue(undefined);

    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(screen.getByText('Delete player'));
    fireEvent.click(screen.getByText('Yes, delete player'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('team-1', 'player-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1', { replace: true });
  });

  it('exports the player record as JSON when an admin clicks Export', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.spyOn(physicalTestsApi, 'listAllPhysicalTests').mockResolvedValue([]);
    const footprint = { testingEntries: [], matches: [] };
    vi.spyOn(footprintApi, 'loadPlayerFootprint').mockResolvedValue(footprint);
    const exportModule = await import('./playerExport');
    const exportSpy = vi.spyOn(exportModule, 'downloadPlayerExport').mockImplementation(() => {});

    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(screen.getByText('Export data (JSON)'));

    await waitFor(() => expect(exportSpy).toHaveBeenCalledWith(basePlayer, [], footprint));
  });

  it('surfaces an error and does not download when the export read fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.spyOn(physicalTestsApi, 'listAllPhysicalTests').mockRejectedValue(new Error('boom'));
    const exportModule = await import('./playerExport');
    const exportSpy = vi.spyOn(exportModule, 'downloadPlayerExport').mockImplementation(() => {});

    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(screen.getByText('Export data (JSON)'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Could not export this player's data. Please try again."
    );
    expect(exportSpy).not.toHaveBeenCalled();
  });

  it('shows an avatar with initials and a level badge next to the name', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, avgScore: 6.8, level: 'Advanced' });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(null);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});

    renderPlayerCard();

    await screen.findByText('Test Player');
    expect(screen.getByText('TP')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('lets an admin record guardian consent for a player imported without it', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, consent: { given: false, date: null, confirmedBy: null } });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const recordSpy = vi
      .spyOn(playersApi, 'recordPlayerConsent')
      .mockResolvedValue({ given: true, date: '2026-10-14', confirmedBy: 'coach@example.com' });

    renderPlayerCard();
    expect(await screen.findByText('Guardian consent not recorded')).toBeInTheDocument();
    const record = screen.getByRole('button', { name: 'Record consent' });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/guardian has consented to storing this player's data/i));
    fireEvent.click(record);

    await waitFor(() => expect(recordSpy).toHaveBeenCalledWith('team-1', 'player-1', 'coach@example.com'));
    expect(await screen.findByText(/Guardian consent recorded/)).toBeInTheDocument();
  });

  it('marks a player as having left the club and shows the deletion date', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
        access: superAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const leftSpy = vi.spyOn(playersApi, 'setPlayerLeftClub').mockResolvedValue(undefined);

    renderPlayerCard();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as left the club' }));

    await waitFor(() => expect(leftSpy).toHaveBeenCalledWith('team-1', 'player-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    expect(await screen.findByText(/due for/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Still in the club' }));
    await waitFor(() => expect(leftSpy).toHaveBeenLastCalledWith('team-1', 'player-1', null));
    expect(await screen.findByRole('button', { name: 'Mark as left the club' })).toBeInTheDocument();
  });
});
