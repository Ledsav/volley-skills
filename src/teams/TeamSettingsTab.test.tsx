import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TeamSettingsTab } from './TeamSettingsTab';
import * as teamsApi from './teamsApi';
import { authValue, superAdminAccess } from '../test/authValue';
import { useAuth } from '../auth/AuthContext';
import type { Team } from '../types/team';

const mockNavigate = vi.fn();

vi.mock('./teamsApi');
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

function renderSettings(team: Team, onTeamUpdated: (team: Team) => void) {
  return render(
    <MemoryRouter>
      <TeamSettingsTab team={team} onTeamUpdated={onTeamUpdated} />
    </MemoryRouter>
  );
}

describe('TeamSettingsTab', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(useAuth).mockReturnValue(authValue({ access: superAdminAccess }));
  });

  it('has no admin-management UI', () => {
    renderSettings(baseTeam, vi.fn());
    expect(screen.queryByLabelText('Add admin by email')).not.toBeInTheDocument();
    expect(screen.queryByText('Admins')).not.toBeInTheDocument();
  });

  it('saves edited team info', async () => {
    const updateSpy = vi.spyOn(teamsApi, 'updateTeamInfo').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();
    renderSettings(baseTeam, onTeamUpdated);

    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'U17 Elite' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save team info' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('team-1', { name: 'U17 Elite', description: '', notes: '' })
    );
    expect(onTeamUpdated).toHaveBeenCalledWith(expect.objectContaining({ name: 'U17 Elite' }));
  });

  it('shows Delete team to a super-admin', () => {
    renderSettings(baseTeam, vi.fn());
    expect(screen.getByRole('button', { name: 'Delete team' })).toBeInTheDocument();
  });

  it('hides Delete team from a non-super-admin', () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    renderSettings(baseTeam, vi.fn());
    expect(screen.queryByRole('button', { name: 'Delete team' })).not.toBeInTheDocument();
  });

  it('does nothing until the delete team confirmation is accepted', () => {
    const deleteSpy = vi.spyOn(teamsApi, 'deleteTeam').mockResolvedValue(undefined);
    renderSettings(baseTeam, vi.fn());

    fireEvent.click(screen.getByText('Delete team'));
    expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('deletes the team and navigates to /teams when confirmed', async () => {
    const deleteSpy = vi.spyOn(teamsApi, 'deleteTeam').mockResolvedValue(undefined);
    renderSettings(baseTeam, vi.fn());

    fireEvent.click(screen.getByText('Delete team'));
    fireEvent.click(screen.getByText('Yes, delete team'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('team-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/teams', { replace: true });
  });

  it('shows an error message when deleting the team fails', async () => {
    vi.spyOn(teamsApi, 'deleteTeam').mockRejectedValue(new Error('denied'));
    renderSettings(baseTeam, vi.fn());

    fireEvent.click(screen.getByText('Delete team'));
    fireEvent.click(screen.getByText('Yes, delete team'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
