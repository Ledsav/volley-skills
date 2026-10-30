import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from './TeamPage';
import * as teamsApi from './teamsApi';
import * as playersApi from '../players/playersApi';
import { useAuth } from '../auth/AuthContext';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';
import { NoticeProvider } from '../components/Notice';
import { PageChromeProvider, usePageChromeState } from '../layout/PageChrome';
import { WithChrome } from '../test/chromeProbe';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
const flag = vi.hoisted(() => ({ italian: false }));
vi.mock('../i18n/locales', async (orig) => {
  const actual = await orig<typeof import('../i18n/locales')>();
  return { ...actual, get ITALIAN_ENABLED() { return flag.italian; } };
});
vi.mock('./teamsApi');
vi.mock('../players/playersApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../calendar/calendarApi', () => ({
  listCalendarSessions: vi.fn().mockResolvedValue([]),
  getCalendarSession: vi.fn().mockResolvedValue(null),
  createCalendarSession: vi.fn(),
  deleteCalendarSession: vi.fn(),
}));

vi.mock('../matches/matchesApi', () => ({
  listMatches: vi.fn().mockResolvedValue({ matches: [], lastDoc: null, hasMore: false }),
  listMatchesInRange: vi.fn().mockResolvedValue([]),
}));

const team: Team = {
  id: 'team-1',
  name: 'U17 Boys',
  ageGroup: 'U17',
  season: '2026',
  description: 'Regional squad',
  notes: '',
  adminEmails: [],
  developmentPlan: { goals: [], focusAreas: [], notes: '' } as unknown as Team['developmentPlan'],
  createdBy: 'coach-uid',
  createdAt: null,
};

function ChromeSummary() {
  const c = usePageChromeState();
  return <div data-testid="chrome">{JSON.stringify({ title: c.title, action: c.mainAction?.label ?? null, more: c.more.map((m) => (m.kind === 'divider' ? '-' : m.label)) })}</div>;
}

function LocationProbe() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname + l.search}</div>;
}

function renderTeamPage(url: string | { pathname: string; search?: string; state?: unknown } = '/teams/team-1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <NoticeProvider>
        <WithChrome>
          <Routes>
            <Route path="/teams/:teamId" element={<><TeamPage /><LocationProbe /></>} />
          </Routes>
        </WithChrome>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('TeamPage', () => {
  beforeEach(() => {
    flag.italian = false;
    vi.mocked(playersApi.listPlayersDueForDeletion).mockResolvedValue([]);
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
  });

  it('add-player pending action opens the add player dialog', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage({ pathname: '/teams/team-1', search: '?tab=roster', state: { pendingAction: 'add-player' } });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=roster'));
  });

  it('uses the lowercased appUser email, not the raw sign-in email, for team admin', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { uid: 'coach-uid', email: 'Coach@Example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
      })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  });

  it('does not show the gender prompt while Italian is off (R20)', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByText("Is this a women's, men's or mixed team?")).not.toBeInTheDocument();
  });

  it('asks a team admin once whether the team is women, men or mixed when gender is missing and Italian is on', async () => {
    flag.italian = true;
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    const updateSpy = vi.spyOn(teamsApi, 'updateTeamInfo').mockResolvedValue(undefined);
    renderTeamPage();
    expect(await screen.findByText("Is this a women's, men's or mixed team?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Women' }));
    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith('team-1', { gender: 'women' }));
    await waitFor(() => expect(screen.queryByText("Is this a women's, men's or mixed team?")).not.toBeInTheDocument());
  });

  it('does not ask when the team has a gender, or when the person is not a team admin', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, gender: 'men', adminEmails: ['coach@example.com'] });
    const { unmount } = renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByText("Is this a women's, men's or mixed team?")).not.toBeInTheDocument();
    unmount();

    vi.mocked(useAuth).mockReturnValue(
      authValue({ firebaseUser: { uid: 'm' } as never, appUser: { uid: 'm', email: 'member@example.com', onboarding: EMPTY_ONBOARDING } })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByText("Is this a women's, men's or mixed team?")).not.toBeInTheDocument();
  });

  it('shows the not-found state when the team cannot be read', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    renderTeamPage();
    expect(await screen.findByRole('heading', { name: 'Team not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All teams' })).toHaveAttribute('href', '/teams');
    expect(screen.queryByText('Loading team...')).not.toBeInTheDocument();
  });

  it('shows a retryable error (not not-found) when the team load fails transiently', async () => {
    const spy = vi.spyOn(teamsApi, 'getTeam').mockRejectedValueOnce({ code: 'unavailable' });
    spy.mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByText('Could not load this team.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Team not found' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'U17 Boys' })).toBeInTheDocument();
  });

  it('opens the tab named in ?tab= and updates the URL on tab change, dropping stats filters', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=stats&comp=cup&range=last5');
    expect(await screen.findByRole('tab', { name: 'Stats', selected: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }));
    expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=matches');
  });

  it('falls back to Roster for ?tab=stats when not a team admin', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=stats');
    expect(await screen.findByRole('tab', { name: 'Roster', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Stats' })).not.toBeInTheDocument();
  });

  it('maps the old ?tab= ids onto the renamed tabs', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=overview');
    expect(await screen.findByRole('tab', { name: 'Roster', selected: true })).toBeInTheDocument();
  });

  it('orders the tabs by how often a coach uses them, Settings last', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('tab', { name: 'Roster' });
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Roster', 'Calendar', 'Matches', 'Stats', 'Development plan', 'Physical testing', 'Settings',
    ]);
  });

  it('shows the team calendar when the Calendar tab is selected', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    fireEvent.click(await screen.findByRole('tab', { name: 'Calendar' }));

    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
  });

  it('switches sections from the section tabs', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    expect(await screen.findByRole('tab', { name: 'Roster' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

    expect(await screen.findByLabelText('Next month')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Calendar' })).toHaveAttribute('aria-selected', 'true');
  });

  it('tightens the page chrome on mobile', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();
    const heading = await screen.findByRole('heading', { name: 'U17 Boys' });

    const page = heading.closest('[data-page-header]')?.parentElement as HTMLElement;
    expect(page).toHaveAttribute('data-page-container', 'content');
    expect(page.className).toContain('px-[var(--page-gutter)]');

    // The title sits on the canvas, not inside a card that would nest the tabs' own cards.
    expect(heading.closest('.shadow-card')).toBeNull();
  });

  it('the roster publishes Add player, with Import players in More', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    const probe = within(screen.getByTestId('chrome-probe'));
    expect(await probe.findByRole('button', { name: 'Add player' })).toBeInTheDocument();
    expect(probe.getByRole('button', { name: 'Import players' })).toBeInTheDocument();
    // no inline action row any more
    expect(screen.queryByRole('button', { name: '+ Add player' })).not.toBeInTheDocument();
    fireEvent.click(probe.getByRole('button', { name: 'Add player' }));
    expect(await screen.findByRole('dialog', { name: 'Add player' })).toBeInTheDocument();
  });

  it('Import players from More opens the player import', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    fireEvent.click(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Import players' }));
    expect(screen.getByRole('dialog', { name: 'Import players' })).toBeInTheDocument();
  });

  it('Edit plan in the toolbar opens the plan editor', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({
      ...team,
      developmentPlan: { shortTermObjectives: [], seasonObjectives: [], generalNotes: '' },
    });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=plan');
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Edit plan' }));
    expect(await screen.findByRole('dialog', { name: 'Edit development plan' })).toBeInTheDocument();
  });

  it('the team tabs are a segmented control pinned under the toolbar', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('heading', { name: 'U17 Boys' })).toBeInTheDocument();
    expect(screen.getByText('2026 · U17')).toBeInTheDocument();
    const list = screen.getByRole('tablist', { name: 'Team section' });
    expect(list.parentElement?.className).toContain('sticky');
    expect(list.parentElement?.style.top).toContain('52px');
    expect(screen.getByRole('tabpanel', { name: 'Roster' })).toBeInTheDocument();
  });

  it('a tab change drops the calendar session param', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage('/teams/team-1?tab=calendar&session=s1');
    fireEvent.click(await screen.findByRole('tab', { name: 'Matches' }));
    expect(screen.getByTestId('loc').textContent).toBe('/teams/team-1?tab=matches');
  });

  it('hides the Calendar tab when the user has no trainings access', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue()); // member, no sections
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('heading', { name: 'U17 Boys' });
    expect(screen.queryByRole('tab', { name: 'Calendar' })).not.toBeInTheDocument();
  });

  it('shows the Calendar tab with trainings access', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({ access: { isClubAdmin: false, sections: { exercises: false, trainings: true, guides: false } } })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('opens the player bulk-import dialog from the roster tab', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    renderTeamPage();

    await screen.findByRole('heading', { name: 'U17 Boys' });
    fireEvent.click(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Import players' }));

    expect(screen.getByRole('dialog', { name: 'Import players' })).toBeInTheDocument();
    expect(screen.getByText(/consent not given/i)).toBeInTheDocument();
  });

  it('shows a consent-reminder notice after a successful player import', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(team);
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    vi.spyOn(playersApi, 'bulkCreatePlayers').mockResolvedValue(2);

    renderTeamPage();

    await screen.findByRole('heading', { name: 'U17 Boys' });
    fireEvent.click(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Import players' }));
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

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/imported 2 players with consent not given/i)
    );
    expect(playersApi.bulkCreatePlayers).toHaveBeenCalledTimes(1);
  });

  it('shows the Stats tab only to team admins', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['user@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    expect(await screen.findByRole('tab', { name: 'Stats' })).toBeInTheDocument();
  });

  it('hides the Stats tab for viewers', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue());
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['someone@else.be'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    renderTeamPage();
    await screen.findByRole('tab', { name: 'Roster' });
    expect(screen.queryByRole('tab', { name: 'Stats' })).toBeNull();
  });

  it('the Matches tab owns the toolbar; Roster adds players and Settings has no action', async () => {
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue({ ...team, adminEmails: ['coach@example.com'] });
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    const read = () => JSON.parse(screen.getByTestId('chrome').textContent ?? '{}');
    render(
      <MemoryRouter initialEntries={['/teams/team-1']}>
        <NoticeProvider>
          <PageChromeProvider>
            <ChromeSummary />
            <Routes>
              <Route path="/teams/:teamId" element={<TeamPage />} />
            </Routes>
          </PageChromeProvider>
        </NoticeProvider>
      </MemoryRouter>
    );
    await screen.findByRole('heading', { name: 'U17 Boys' });
    await waitFor(() => expect(read()).toEqual({ title: 'U17 Boys', action: 'Add player', more: ['Import players'] }));
    fireEvent.click(screen.getByRole('tab', { name: 'Matches' }));
    await waitFor(() => expect(read().action).toBe('New match'));
    expect(read().title).toBe('U17 Boys');
    expect(read().more).toEqual(['Import from DataVolley (.dvw)', 'Season awards']);
    await screen.findByText('No matches yet.');
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));
    await waitFor(() => expect(read()).toEqual({ title: 'U17 Boys', action: 'New session', more: [] }));
    fireEvent.click(screen.getByRole('tab', { name: 'Physical testing' }));
    await waitFor(() => expect(read()).toEqual({ title: 'U17 Boys', action: 'New testing session', more: [] }));
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    await waitFor(() => expect(read()).toEqual({ title: 'U17 Boys', action: null, more: [] }));
  });
});
