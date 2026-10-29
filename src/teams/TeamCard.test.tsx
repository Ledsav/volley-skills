import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Team } from '../types/team';
import { TeamCard, teamMonogram } from './TeamCard';
import * as teamsApi from './teamsApi';

vi.mock('./teamsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const team: Team = {
  id: 't1', name: 'U17 Girls', ageGroup: 'U17', season: '2026-27', description: '', notes: '',
  adminEmails: [], developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' }, createdBy: '', createdAt: null,
};

function renderCard(withMenu = false) {
  render(<MemoryRouter><ul><TeamCard team={team} layout="card" withMenu={withMenu} /></ul></MemoryRouter>);
}

describe('TeamCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the player count and a band-coloured level pill', async () => {
    vi.mocked(teamsApi.getTeamSummary).mockResolvedValue({ players: 14, avgScore: 6.4 });
    renderCard();
    expect(await screen.findByText(/14 players/)).toBeInTheDocument();
    expect(screen.getByText('Advanced').className).toContain('bg-blue-tint');
  });

  it('shows a dash pill when no player has a score', async () => {
    vi.mocked(teamsApi.getTeamSummary).mockResolvedValue({ players: 2, avgScore: null });
    renderCard();
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('a failed summary leaves the card without count or level', async () => {
    vi.mocked(teamsApi.getTeamSummary).mockRejectedValue(new Error('offline'));
    renderCard();
    await waitFor(() => expect(teamsApi.getTeamSummary).toHaveBeenCalled());
    expect(screen.getByText('U17 Girls')).toBeInTheDocument();
    expect(screen.getByText('U17 · Season 2026-27')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/teams/t1');
    expect(screen.queryByText(/players/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers Open and Open in new tab on right-click when withMenu is set', async () => {
    vi.mocked(teamsApi.getTeamSummary).mockResolvedValue({ players: 1, avgScore: null });
    renderCard(true);
    fireEvent.contextMenu(screen.getByRole('link'));
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Open in new tab' })).toBeInTheDocument();
  });
});

describe('teamMonogram', () => {
  it('keeps a short one-word name whole and takes initials otherwise', () => {
    expect(teamMonogram('U17')).toBe('U17');
    expect(teamMonogram('Seniors')).toBe('SE');
    expect(teamMonogram('Men 1')).toBe('M1');
  });
});
