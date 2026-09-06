import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamSettingsTab } from './TeamSettingsTab';
import * as teamsApi from './teamsApi';
import type { Team } from '../types/team';

vi.mock('./teamsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

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

describe('TeamSettingsTab', () => {
  it('adds a new admin email and reflects it in the list', async () => {
    vi.spyOn(teamsApi, 'addTeamAdmin').mockResolvedValue(undefined);
    const onTeamUpdated = vi.fn();

    render(<TeamSettingsTab team={baseTeam} onTeamUpdated={onTeamUpdated} />);
    fireEvent.change(screen.getByLabelText('Add admin by email'), { target: { value: 'assistant@example.com' } });
    fireEvent.click(screen.getByText('Grant access'));

    await waitFor(() =>
      expect(onTeamUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ adminEmails: ['coach@example.com', 'assistant@example.com'] })
      )
    );
  });

  it('does not show a remove button when there is only one admin', () => {
    render(<TeamSettingsTab team={baseTeam} onTeamUpdated={vi.fn()} />);
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });
});
