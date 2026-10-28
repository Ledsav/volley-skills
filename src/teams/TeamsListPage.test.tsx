import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WithChrome } from '../test/chromeProbe';
import { describe, expect, it, vi } from 'vitest';
import { TeamsListPage } from './TeamsListPage';
import * as teamsApi from './teamsApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';

vi.mock('./teamsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const team: Team = {
  id: 'team-1',
  name: 'U17 Girls',
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
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <WithChrome><TeamsListPage /></WithChrome>
      </MemoryRouter>
    );

    expect(await screen.findByText('U17 Girls')).toBeInTheDocument();
    expect(screen.getByText('U17')).toBeInTheDocument();
    expect(screen.getByText('Season 2026-27')).toBeInTheDocument();
  });

  it('adapts the page header and gutter for mobile: title stacks above a full-width action row', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <WithChrome><TeamsListPage /></WithChrome>
      </MemoryRouter>
    );

    const heading = await screen.findByRole('heading', { name: 'Teams' });

    const page = heading.closest('[data-page-header]')?.parentElement as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    const header = heading.closest('[data-page-header]') as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    // the page's actions live in the shell toolbar, not in a content row
    expect(heading.closest('[data-page-header]')?.querySelector('button')).toBeNull();
  });

  it('opens the bulk-import dialog from the Import button', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });

    render(
      <MemoryRouter>
        <WithChrome><TeamsListPage /></WithChrome>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import teams/ })).toBeInTheDocument();
  });

  it('opens create team from a pending action', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams', state: { pendingAction: 'new-team' } }]}>
        <WithChrome>
          <TeamsListPage />
        </WithChrome>
      </MemoryRouter>
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not open create team from a pending action for a member', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
    render(
      <MemoryRouter initialEntries={[{ pathname: '/teams', state: { pendingAction: 'new-team' } }]}>
        <WithChrome>
          <TeamsListPage />
        </WithChrome>
      </MemoryRouter>
    );
    await screen.findByText('No teams assigned yet — ask your club admin.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('hides Create team and Import from a member', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue({ teams: [], lastDoc: null, hasMore: false });
    render(
      <MemoryRouter>
        <WithChrome><TeamsListPage /></WithChrome>
      </MemoryRouter>
    );
    await screen.findByText('No teams assigned yet — ask your club admin.');
    expect(screen.queryByRole('button', { name: 'Create team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument();
  });
});
