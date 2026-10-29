import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WithChrome } from '../test/chromeProbe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const mineTeam: Team = { ...team, id: 'team-mine', name: 'U15 Mine' };
const page = (teams: Team[], hasMore = false, lastDoc: unknown = null) => ({ teams, lastDoc: lastDoc as never, hasMore });

function asClubAdmin() {
  vi.mocked(useAuth).mockReturnValue(
    authValue({
      firebaseUser: { email: 'coach@example.com' } as never,
      appUser: { uid: 'coach-uid', email: 'coach@example.com' },
      access: clubAdminAccess,
    })
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WithChrome><TeamsListPage /></WithChrome>
    </MemoryRouter>
  );
}

describe('TeamsListPage', () => {
  beforeEach(() => {
    localStorage.clear();
    // a club admin lists the whole club by default; the same single team keeps the older tests unchanged
    vi.spyOn(teamsApi, 'listClubTeams').mockResolvedValue({ teams: [team], lastDoc: null, hasMore: false });
    vi.spyOn(teamsApi, 'getTeamSummary').mockResolvedValue({ players: 12, avgScore: 6.5 });
  });
  afterEach(() => localStorage.clear());

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
    expect(screen.getByText('U17 · Season 2026-27')).toBeInTheDocument();
  });

  it('adapts the page gutter for mobile; the actions live in the shell toolbar', async () => {
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

  it('opens the create dialog from the main action published to the shell', async () => {
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
    await screen.findByText('U17 Girls');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('chrome-probe')).getByRole('button', { name: 'Create team' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

  it('a club admin lists every club team by default', async () => {
    asClubAdmin();
    const mine = vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([mineTeam]));
    renderPage();
    expect(await screen.findByText('U17 Girls')).toBeInTheDocument();
    expect(teamsApi.listClubTeams).toHaveBeenCalledWith(null);
    expect(mine).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
  });

  it('Mine switches to the teams they are listed on and is remembered', async () => {
    asClubAdmin();
    const mine = vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([mineTeam]));
    renderPage();
    await screen.findByText('U17 Girls');
    fireEvent.click(screen.getByRole('radio', { name: 'Mine' }));
    expect(await screen.findByText('U15 Mine')).toBeInTheDocument();
    expect(screen.queryByText('U17 Girls')).not.toBeInTheDocument();
    expect(mine).toHaveBeenCalledWith('coach@example.com', null);
    expect(localStorage.getItem('vcb.teamsFilter')).toBe('mine');
  });

  it('starts on Mine when that was the last choice', async () => {
    asClubAdmin();
    localStorage.setItem('vcb.teamsFilter', 'mine');
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([mineTeam]));
    renderPage();
    expect(await screen.findByText('U15 Mine')).toBeInTheDocument();
    expect(teamsApi.listClubTeams).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'Mine' })).toHaveAttribute('aria-checked', 'true');
  });

  it('says so when a club admin is on no team on Mine', async () => {
    asClubAdmin();
    localStorage.setItem('vcb.teamsFilter', 'mine');
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("You're not listed on any team yet.")).toBeInTheDocument();
  });

  it('a member gets no filter and only their teams', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    localStorage.setItem('vcb.teamsFilter', 'all');
    const mine = vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([mineTeam]));
    renderPage();
    expect(await screen.findByText('U15 Mine')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(mine).toHaveBeenCalled();
    expect(teamsApi.listClubTeams).not.toHaveBeenCalled();
  });

  it('a slow All page that lands after switching to Mine is dropped', async () => {
    asClubAdmin();
    let resolveAll: (p: ReturnType<typeof page>) => void = () => undefined;
    vi.spyOn(teamsApi, 'listClubTeams').mockReturnValue(new Promise((r) => (resolveAll = r)));
    vi.spyOn(teamsApi, 'listMyTeams').mockResolvedValue(page([mineTeam]));
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: 'Mine' }));
    expect(await screen.findByText('U15 Mine')).toBeInTheDocument();
    resolveAll(page([team]));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.getByText('U15 Mine')).toBeInTheDocument();
    expect(screen.queryByText('U17 Girls')).not.toBeInTheDocument();
  });

  it('Load more pages the current filter', async () => {
    asClubAdmin();
    localStorage.setItem('vcb.teamsFilter', 'mine');
    const cursor = { id: 'cursor' };
    const mine = vi
      .spyOn(teamsApi, 'listMyTeams')
      .mockResolvedValueOnce(page([mineTeam], true, cursor))
      .mockResolvedValueOnce(page([{ ...mineTeam, id: 'team-mine-2', name: 'U13 Mine' }]));
    renderPage();
    await screen.findByText('U15 Mine');
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('U13 Mine')).toBeInTheDocument();
    expect(screen.getByText('U15 Mine')).toBeInTheDocument();
    expect(mine).toHaveBeenLastCalledWith('coach@example.com', cursor);
    expect(teamsApi.listClubTeams).not.toHaveBeenCalled();
  });

  it('shows skeleton rows until the first page arrives, not "No teams yet."', async () => {
    asClubAdmin();
    let resolveAll: (p: ReturnType<typeof page>) => void = () => undefined;
    vi.spyOn(teamsApi, 'listClubTeams').mockReturnValue(new Promise((r) => (resolveAll = r)));
    renderPage();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Loading teams…');
    expect(status.querySelectorAll('[data-skeleton-block]').length).toBeGreaterThan(0);
    expect(screen.queryByText('No teams yet.')).not.toBeInTheDocument();
    resolveAll(page([]));
    expect(await screen.findByText('No teams yet.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
