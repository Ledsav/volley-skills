import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authValue, clubAdminAccess } from '../test/authValue';
import type { Team } from '../types/team';
import { EMPTY_ONBOARDING } from './onboardingState';
import { GetStartedCard } from './GetStartedCard';

const useAuthMock = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => useAuthMock() }));

const api = vi.hoisted(() => ({
  getTeamSummary: vi.fn(),
  countClubMembers: vi.fn(),
  hasAnySession: vi.fn(),
  hasAnyMatch: vi.fn(),
}));
vi.mock('../teams/teamsApi', () => ({ getTeamSummary: api.getTeamSummary }));
vi.mock('../clubs/clubsApi', () => ({ countClubMembers: api.countClubMembers }));
vi.mock('../calendar/calendarApi', () => ({ hasAnySession: api.hasAnySession }));
vi.mock('../matches/matchesApi', () => ({ hasAnyMatch: api.hasAnyMatch }));

const undoable = vi.fn();
vi.mock('../components/Notice', () => ({ useUndoable: () => undoable, useNotify: () => vi.fn() }));

const update = vi.fn();
const oneTeam = [{ id: 't1', name: 'U17' }] as Team[];
const twoTeams = [
  { id: 't1', name: 'U17', ageGroup: 'U17', season: '2026' },
  { id: 't2', name: 'U15', ageGroup: 'U15', season: '2026' },
] as Team[];

function Where() {
  const l = useLocation();
  const pending = (l.state as { pendingAction?: string } | null)?.pendingAction ?? '';
  return <p data-testid="where">{`${l.pathname}${l.search}|${pending}`}</p>;
}

function ui(teams: Team[], adminsAnyTeam = true) {
  return (
    <MemoryRouter>
      <GetStartedCard teams={teams} adminsAnyTeam={adminsAnyTeam} />
      <Where />
    </MemoryRouter>
  );
}

function setup(teams: Team[] = oneTeam, over: Parameters<typeof authValue>[0] = {}) {
  useAuthMock.mockReturnValue(authValue({ access: clubAdminAccess, role: 'admin', updateOnboarding: update, ...over }));
  return render(ui(teams));
}

describe('GetStartedCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue(undefined);
    api.getTeamSummary.mockResolvedValue({ players: 5, avgScore: null });
    api.countClubMembers.mockResolvedValue(1);
    api.hasAnySession.mockResolvedValue(false);
    api.hasAnyMatch.mockResolvedValue(false);
  });

  it('renders no card while onboarding is unknown, or when the club is hidden, and reads nothing', async () => {
    for (const over of [{ onboarding: null }, { onboarding: { ...EMPTY_ONBOARDING, hiddenChecklists: ['club-1'] } }]) {
      const { unmount } = setup(oneTeam, over);
      await act(async () => {});
      expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
      unmount();
    }
    expect(api.hasAnySession).not.toHaveBeenCalled();
  });

  it('renders no card while the facts load, or when the person has no steps', async () => {
    api.hasAnySession.mockReturnValue(new Promise(() => {}));
    const first = setup();
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
    first.unmount();
    useAuthMock.mockReturnValue(authValue({ updateOnboarding: update }));
    render(ui([], false));
    await act(async () => {});
    expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
  });

  it('shows progress, done rows named "..., done" and help only on open rows', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeInTheDocument();
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create your first team, done' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your players, done' })).toBeInTheDocument();
    expect(screen.queryByText('Start with the team you coach.')).toBeNull();
    expect(screen.getByText('Put your next session on the calendar.')).toBeInTheDocument();
  });

  it('Plan a training goes straight to the one team calendar with the pending action', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Plan a training/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/teams/t1?tab=calendar|new-session');
  });

  it('Plan a training with two teams opens the team picker', async () => {
    setup(twoTeams);
    fireEvent.click(await screen.findByRole('button', { name: /Plan a training/ }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Scout a match, Add a coach and Create your first team navigate', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Scout a match/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/teams/t1?tab=matches|new-match');
    fireEvent.click(screen.getByRole('button', { name: /Add a coach/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/club?tab=people|');
    fireEvent.click(screen.getByRole('button', { name: 'Create your first team, done' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/teams|new-team');
  });

  it('Add your players uses the roster action', async () => {
    api.getTeamSummary.mockResolvedValue({ players: 0, avgScore: null });
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Add your players/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/teams/t1?tab=roster|add-player');
  });

  it('Hide removes the card at once, defers the write behind Undo, and Undo brings it back', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Get started' });
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));
    expect(screen.queryByRole('heading', { name: 'Get started' })).toBeNull();
    expect(update).not.toHaveBeenCalled();
    const opts = undoable.mock.calls[0][0];
    expect(opts.message).toBe('Get started hidden');
    await opts.commit();
    expect(update).toHaveBeenCalledWith({ kind: 'hideChecklist', clubId: 'club-1' });
    act(() => opts.onUndo());
    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeInTheDocument();
  });

  it('all done on first load shows the ready line for an admin and hides the checklist once', async () => {
    api.hasAnySession.mockResolvedValue(true);
    api.hasAnyMatch.mockResolvedValue(true);
    api.countClubMembers.mockResolvedValue(2);
    const { rerender } = setup();
    expect(await screen.findByText('Your club is ready.')).toBeInTheDocument();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ kind: 'hideChecklist', clubId: 'club-1' });
    rerender(ui(oneTeam));
    await act(async () => {});
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('says "You\'re all set." to a coach', async () => {
    api.hasAnySession.mockResolvedValue(true);
    api.hasAnyMatch.mockResolvedValue(true);
    useAuthMock.mockReturnValue(authValue({ updateOnboarding: update }));
    render(ui(oneTeam));
    expect(await screen.findByText("You're all set.")).toBeInTheDocument();
  });

  it('a failing fact leaves its step open and shows no alert', async () => {
    api.hasAnySession.mockRejectedValue(new Error('denied'));
    setup();
    await screen.findByRole('heading', { name: 'Get started' });
    await waitFor(() => expect(screen.getByRole('button', { name: /Plan a training/ })).toBeInTheDocument());
    expect(screen.getByText('2 of 5')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
