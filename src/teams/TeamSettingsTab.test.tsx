import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TeamSettingsTab } from './TeamSettingsTab';
import * as teamsApi from './teamsApi';
import type { Team } from '../types/team';

const mockNavigate = vi.fn();

vi.mock('./teamsApi');
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
  });

  it('adds a new admin email and reflects it in the list', async () => {
    vi.spyOn(teamsApi, 'addTeamAdmin').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();

    renderSettings(baseTeam, onTeamUpdated);
    fireEvent.change(screen.getByLabelText('Add admin by email'), { target: { value: 'assistant@example.com' } });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() =>
      expect(onTeamUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
      )
    );
  });

  it('trims and lowercases the entered email before granting access', async () => {
    const addSpy = vi.spyOn(teamsApi, 'addTeamAdmin').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();

    renderSettings(baseTeam, onTeamUpdated);
    fireEvent.change(screen.getByLabelText('Add admin by email'), {
      target: { value: '  Assistant@Example.com  ' },
    });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() =>
      expect(addSpy).toHaveBeenCalledWith('team-1', 'assistant@example.com', ['coach@example.com'])
    );
    expect(onTeamUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
    );
  });

  it('does not re-add an email that is already an admin', async () => {
    const addSpy = vi.spyOn(teamsApi, 'addTeamAdmin').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();

    renderSettings(baseTeam, onTeamUpdated);
    fireEvent.change(screen.getByLabelText('Add admin by email'), { target: { value: 'Coach@Example.com' } });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(addSpy).not.toHaveBeenCalled();
    expect(onTeamUpdated).not.toHaveBeenCalled();
  });

  it('shows an error message when granting access is rejected', async () => {
    vi.spyOn(teamsApi, 'addTeamAdmin').mockRejectedValue({ code: 'permission-denied' });
    const onTeamUpdated = vi.fn();

    renderSettings(baseTeam, onTeamUpdated);
    fireEvent.change(screen.getByLabelText('Add admin by email'), { target: { value: 'assistant@example.com' } });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(onTeamUpdated).not.toHaveBeenCalled();
  });

  it('stacks each settings section for mobile so nothing is cramped side by side', () => {
    const team = { ...baseTeam, adminEmails: ['coach@example.com', 'assistant@example.com'] };
    renderSettings(team, vi.fn());

    const adminRow = screen.getByText('assistant@example.com').closest('li') as HTMLElement;
    expect(adminRow.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(adminRow.className).toContain('sm:flex-row');

    const grant = screen.getByRole('button', { name: 'Grant access' });
    expect((grant.parentElement as HTMLElement).className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(grant.className).toContain('w-full');
    expect(grant.className).toContain('sm:w-auto');

    const dangerRow = screen.getByRole('button', { name: 'Delete team' }).parentElement as HTMLElement;
    expect(dangerRow.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(dangerRow.className).toContain('sm:flex-row');
  });

  it('does not show a remove button when there is only one admin', () => {
    renderSettings(baseTeam, vi.fn());
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
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
