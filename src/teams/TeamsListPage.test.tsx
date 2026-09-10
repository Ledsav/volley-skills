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
    expect(screen.getByText('VCB · U17')).toBeInTheDocument();
    expect(screen.getByText('Season 2026-27')).toBeInTheDocument();
  });

  it('adapts the page header and gutter for mobile: title stacks above a full-width action row', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
      loading: false,
      authError: null,
    });
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    const { container } = render(
      <MemoryRouter>
        <TeamsListPage />
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: 'Teams' });

    const page = container.firstChild as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    const header = heading.parentElement as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    const actions = screen.getByRole('button', { name: 'Create team' }).parentElement as HTMLElement;
    expect(actions.className).toContain('grid-cols-2');
    expect(actions.className).toContain('sm:flex');
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
