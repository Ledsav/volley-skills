process.env.TZ = 'Europe/Rome';

import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PlayerCardPage } from './PlayerCardPage';
import { NoticeProvider } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';
import * as playersApi from './playersApi';
import * as teamsApi from '../teams/teamsApi';
import * as physicalTestsApi from './physicalTestsApi';
import * as footprintApi from './playerFootprintApi';
import { useAuth } from '../auth/AuthContext';
import { todayLocalIso } from '../dates/today';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Player } from '../types/player';
import type { Team } from '../types/team';
import * as matchesApi from '../matches/matchesApi';
import type { Match } from '../types/match';

import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';
const mockNavigate = vi.fn();

vi.mock('./playersApi');
vi.mock('../teams/teamsApi');
vi.mock('./physicalTestsApi');
vi.mock('./playerExport');
vi.mock('./playerFootprintApi');
vi.mock('../matches/matchesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const baseTeam: Team = {
  id: 'team-1',
  name: 'U17',
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
    <NoticeProvider>
      <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
        <WithChrome>
          <Routes>
            <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
          </Routes>
        </WithChrome>
      </MemoryRouter>
    </NoticeProvider>
  );
}

/** The toolbar's Edit opens the picker; this picks one row. */
async function pickEdit(row: string) {
  fireEvent.click(await within(await screen.findByTestId('chrome-probe')).findByRole('button', { name: 'Edit' }));
  fireEvent.click(await screen.findByRole('button', { name: row }));
}

/** Sections other than Skills are hidden until their tab is chosen. */
async function openSection(name: string) {
  const tabs = await screen.findByRole('tablist', { name: 'Player sections' });
  fireEvent.click(within(tabs).getByRole('tab', { name }));
}

describe('PlayerCardPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null, appUser: null }));
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([]);
  });

  it('shows match stats and skill suggestions to a team admin', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const serve = { attempts: 15, grades: { '#': 15, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 } };
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([
      {
        id: 'm1', date: '2026-10-08', opponent: 'Rivals',
        summary: {
          players: { 'player-1': { playerId: 'player-1', skills: { S: serve }, points: 15, errors: 0, attackEff: null, serveEff: 1, receptionPos: null, receptionPerfect: null } },
          team: {}, timeoutEffects: [], sourceCounts: { tap: 15, text: 0 },
        },
      } as unknown as Match,
    ]);

    renderPlayerCard();

    expect(await screen.findByRole('button', { name: 'Adapt Serve to 10' })).toBeInTheDocument();
    // the header toggle hides suggestions and is remembered on this device
    const toggle = screen.getByRole('button', { name: 'Match suggestions' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(screen.queryByRole('button', { name: 'Adapt Serve to 10' })).not.toBeInTheDocument();
    expect(localStorage.getItem('vcb.skills.suggestions')).toBe('0');
    fireEvent.click(toggle);
    localStorage.clear();
    await openSection('Matches');
    expect(screen.getByRole('heading', { name: 'Match stats' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivals' })).toBeInTheDocument();
    expect(matchesApi.listFinishedMatches).toHaveBeenCalledWith('team-1');
  });

  it('does not load or show match stats for a viewer', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.mocked(matchesApi.listFinishedMatches).mockClear();

    renderPlayerCard();

    expect(await screen.findByText('Test Player')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Match stats' })).not.toBeInTheDocument();
    expect(matchesApi.listFinishedMatches).not.toHaveBeenCalled();
  });

  it('shows the not-found state instead of loading forever when the read is rejected', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(null);

    renderPlayerCard();

    expect(await screen.findByRole('heading', { name: 'Player not found' })).toBeInTheDocument();
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
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const deleteSpy = vi.spyOn(playersApi, 'deletePlayer').mockResolvedValue(undefined);

    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(await screen.findByText('Delete player…'));
    fireEvent.click(screen.getByText('Yes, delete player'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('team-1', 'player-1'));
    expect(mockNavigate).toHaveBeenCalledWith('/teams/team-1', { replace: true });
  });

  it('exports the player record as JSON when an admin clicks Export', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
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
    await openSection('Privacy');

    fireEvent.click(screen.getByText('Export data (JSON)'));

    await waitFor(() => expect(exportSpy).toHaveBeenCalledWith(basePlayer, [], footprint));
  });

  it('surfaces an error and does not download when the export read fails', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
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
    await openSection('Privacy');

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
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, consent: { given: false, date: null, confirmedBy: null } });
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const recordSpy = vi
      .spyOn(playersApi, 'recordPlayerConsent')
      .mockResolvedValue({ given: true, date: '2026-10-14', confirmedBy: 'coach@example.com' });

    renderPlayerCard();
    await openSection('Privacy');
    expect(await screen.findByText('Guardian consent not recorded')).toBeInTheDocument();
    const record = screen.getByRole('button', { name: 'Record consent' });
    expect(record).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/guardian has consented to storing this player's data/i));
    fireEvent.click(record);

    await waitFor(() => expect(recordSpy).toHaveBeenCalledWith('team-1', 'player-1', 'coach@example.com', todayLocalIso()));
    expect(await screen.findByText(/Guardian consent recorded/)).toBeInTheDocument();
  });

  describe('photo consent', () => {
    function asCoach() {
      vi.mocked(useAuth).mockReturnValue(
        authValue({
          firebaseUser: { email: 'coach@example.com' } as never,
          appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
          access: clubAdminAccess,
        })
      );
      vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
      vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    }

    it('lets a team admin give and withdraw guardian photo consent for a minor', async () => {
      asCoach();
      vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, dob: '2012-01-01' });
      const setSpy = vi.spyOn(playersApi, 'setPhotoConsent').mockResolvedValue();
      renderPlayerCard();
      await openSection('Privacy');
      const toggle = await screen.findByRole('checkbox', { name: 'Guardian consent to use photos in award cards' });
      expect(toggle).not.toBeChecked();
      fireEvent.click(toggle);
      await waitFor(() => expect(setSpy).toHaveBeenCalledWith('team-1', 'player-1', true, 'coach@example.com'));
      await waitFor(() => expect(toggle).toBeChecked());
      fireEvent.click(toggle);
      await waitFor(() => expect(setSpy).toHaveBeenLastCalledWith('team-1', 'player-1', false, 'coach@example.com'));
    });

    it('shows adults no toggle, only the club-agreement note', async () => {
      asCoach();
      vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, dob: '1990-01-01' });
      renderPlayerCard();
      await openSection('Privacy');
      expect(await screen.findByText("Adult: photos follow the club's own agreement with the player")).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: 'Guardian consent to use photos in award cards' })).toBeNull();
    });
  });

  it('marks a player as having left the club and shows the deletion date', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const leftSpy = vi.spyOn(playersApi, 'setPlayerLeftClub').mockResolvedValue(undefined);

    renderPlayerCard();
    await openSection('Privacy');
    fireEvent.click(await screen.findByRole('button', { name: 'Mark as left the club' }));

    await waitFor(() => expect(leftSpy).toHaveBeenCalledWith('team-1', 'player-1', expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
    expect(await screen.findByText(/due for/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Still in the club' }));
    await waitFor(() => expect(leftSpy).toHaveBeenLastCalledWith('team-1', 'player-1', null));
    expect(await screen.findByRole('button', { name: 'Mark as left the club' })).toBeInTheDocument();
  });

  it('marks left with the local date just after midnight', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    const leftSpy = vi.spyOn(playersApi, 'setPlayerLeftClub').mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-14T22:30:00Z'));
    try {
      renderPlayerCard();
      await openSection('Privacy');
      fireEvent.click(await screen.findByRole('button', { name: 'Mark as left the club' }));
      await waitFor(() => expect(leftSpy).toHaveBeenCalledWith('team-1', 'player-1', '2026-10-15'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('splits the profile into sections, with Matches and Privacy for admins only', async () => {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    renderPlayerCard();
    const tabs = await screen.findByRole('tablist', { name: 'Player sections' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Skills', 'Matches', 'Physical', 'Plan', 'Contact', 'Privacy']);
    expect(within(tabs).getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete player' })).not.toBeInTheDocument();
    expect(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Delete player…' })).toBeInTheDocument();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Privacy' }));
    expect(screen.queryByRole('button', { name: 'Delete player' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Skills' })).not.toBeInTheDocument();
  });

  it('shows a viewer only the sections they can use', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    renderPlayerCard();
    const tabs = await screen.findByRole('tablist', { name: 'Player sections' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Skills', 'Physical', 'Plan', 'Contact']);
  });

  function asAdmin() {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
  }

  it('Edit opens the section picker, and picking Guardians opens that sheet on the Contact panel', async () => {
    asAdmin();
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    renderPlayerCard();

    await pickEdit('Guardians');

    expect(await screen.findByRole('dialog', { name: 'Edit guardians' })).toBeInTheDocument();
    const tabs = screen.getByRole('tablist', { name: 'Player sections' });
    expect(within(tabs).getByRole('tab', { name: 'Contact' })).toHaveAttribute('aria-selected', 'true');
  });

  it('closing an edit sheet opened from the Edit picker returns focus to the toolbar Edit', async () => {
    asAdmin();
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    renderPlayerCard();

    const edit = await within(await screen.findByTestId('chrome-probe')).findByRole('button', { name: 'Edit' });
    edit.focus();
    await pickEdit('Skills');
    const dialog = await screen.findByRole('dialog', { name: 'Edit skills' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit skills' })).not.toBeInTheDocument());
    expect(edit).toHaveFocus();
  });

  it('Delete player… is in More and still confirms with focus on Cancel', async () => {
    asAdmin();
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    const deleteSpy = vi.spyOn(playersApi, 'deletePlayer').mockResolvedValue(undefined);
    renderPlayerCard();
    await screen.findByText('Test Player');

    fireEvent.click(await within(screen.getByTestId('chrome-probe')).findByRole('button', { name: 'Delete player…' }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('a viewer gets no toolbar actions', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    renderPlayerCard();
    await screen.findByText('Test Player');

    await act(async () => undefined);
    expect(within(screen.getByTestId('chrome-probe')).queryAllByRole('button')).toHaveLength(0);
  });

  it('the level pill takes its band colour', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue({ ...basePlayer, avgScore: 6.4, level: 'Advanced' });
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    renderPlayerCard();

    expect(await screen.findByText('Advanced')).toHaveClass('bg-blue-tint');
  });

  it('links back to the team', async () => {
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(basePlayer);
    vi.spyOn(teamsApi, 'getTeam').mockRejectedValue({ code: 'permission-denied' });
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    renderPlayerCard();

    expect(await screen.findByRole('link', { name: 'Back to team' })).toHaveAttribute('href', '/teams/team-1');
  });
});

describe('PlayerCardPage offline saves', () => {
  function deferred() {
    let resolve: (v?: never) => void = () => undefined;
    let reject: (e: Error) => void = () => undefined;
    const promise = new Promise<undefined>((res, rej) => {
      resolve = res as never;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function setup(player: Player = basePlayer) {
    vi.mocked(useAuth).mockReturnValue(
      authValue({
        firebaseUser: { email: 'coach@example.com' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com', onboarding: EMPTY_ONBOARDING },
        access: clubAdminAccess,
      })
    );
    vi.mocked(matchesApi.listFinishedMatches).mockResolvedValue([]);
    vi.spyOn(playersApi, 'getPlayer').mockResolvedValue(player);
    vi.spyOn(teamsApi, 'getTeam').mockResolvedValue(baseTeam);
    vi.spyOn(physicalTestsApi, 'loadLatestTests').mockResolvedValue({});
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    return render(
      <NoticeProvider>
        <MemoryRouter initialEntries={['/teams/team-1/players/player-1']}>
          <WithChrome>
          <Routes>
            <Route path="/teams/:teamId/players/:playerId" element={<PlayerCardPage />} />
          </Routes>
          </WithChrome>
        </MemoryRouter>
      </NoticeProvider>
    );
  }

  const panel = (name: string) => screen.getByRole('tabpanel', { name, hidden: true });
  const dots = (el: HTMLElement) => within(el).queryAllByRole('img', { name: 'Waiting to sync', hidden: true });

  async function saveSkill() {
    await pickEdit('Skills');
    fireEvent.change(await screen.findByLabelText('Serve'), { target: { value: '6' } });
    // The queued write is registered after the click's microtasks, so keep them inside act.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
  }

  it('offline, a skills save shows a pending dot on Skills until it syncs', async () => {
    const d = deferred();
    vi.spyOn(playersApi, 'updatePlayerSkills').mockReturnValue(d.promise);
    setup();
    await saveSkill();
    await waitFor(() => expect(dots(panel('Skills'))).toHaveLength(1));
    await act(async () => {
      d.resolve();
    });
    expect(dots(panel('Skills'))).toHaveLength(0);
  });

  it('offline, the plan, consent, photo and left-club saves apply at once with pending dots', async () => {
    const never = new Promise<never>(() => undefined);
    vi.spyOn(playersApi, 'updatePlayerDevelopmentPlan').mockReturnValue(never as never);
    vi.spyOn(playersApi, 'recordPlayerConsent').mockReturnValue(never as never);
    vi.spyOn(playersApi, 'setPhotoConsent').mockReturnValue(never as never);
    vi.spyOn(playersApi, 'setPlayerLeftClub').mockReturnValue(never as never);
    setup({ ...basePlayer, consent: { given: false, date: null, confirmedBy: null } });

    await openSection('Plan');
    await pickEdit('Development plan');
    fireEvent.click(await screen.findByText('Save'));
    await waitFor(() => expect(dots(panel('Plan'))).toHaveLength(1));

    await openSection('Privacy');
    fireEvent.click(await screen.findByLabelText(/guardian has consented to storing this player/i));
    fireEvent.click(screen.getByRole('button', { name: 'Record consent' }));
    expect(await screen.findByText(/Guardian consent recorded/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Guardian consent to use photos/));
    fireEvent.click(screen.getByRole('button', { name: 'Mark as left the club' }));
    expect(await screen.findByText(/due for/)).toBeInTheDocument();
    expect(dots(panel('Privacy')).length).toBeGreaterThanOrEqual(3);
  });

  it('a queued save rejected on sync shows the sync-failed alert', async () => {
    const d = deferred();
    vi.spyOn(playersApi, 'updatePlayerSkills').mockReturnValue(d.promise);
    setup();
    await saveSkill();
    await waitFor(() => expect(dots(panel('Skills'))).toHaveLength(1));
    await act(async () => {
      d.reject(new Error('permission-denied'));
    });
    expect(dots(panel('Skills'))).toHaveLength(0);
    expect(
      await screen.findByText('Some changes made offline could not be saved. Reload the page to see the stored card.')
    ).toBeInTheDocument();
  });
});
