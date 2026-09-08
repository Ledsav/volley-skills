import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TeamsListPage } from './TeamsListPage';
import * as teamsApi from './teamsApi';
import { useAuth } from '../auth/AuthContext';
import type { Team } from '../types/team';

vi.mock('./teamsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const team: Team = {
  id: 'team-1',
  name: 'U17 Girls',
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

describe('TeamsListPage', () => {
  it('renders each team as a card with its age group and season', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <TeamsListPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('U17 Girls')).toBeInTheDocument();
    expect(screen.getByText('VCB · U17 · 2026-27')).toBeInTheDocument();
  });

  it('opens the bulk-import dialog from the Import button', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <TeamsListPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import teams/ })).toBeInTheDocument();
  });
});
