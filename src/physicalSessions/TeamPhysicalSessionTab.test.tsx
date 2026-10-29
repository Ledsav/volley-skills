import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WithChrome } from '../test/chromeProbe';
import { TeamPhysicalSessionTab } from './TeamPhysicalSessionTab';
import * as testingSessionsApi from './testingSessionsApi';
import * as playersApi from '../players/playersApi';
import type { Team } from '../types/team';
import type { Player } from '../types/player';

vi.mock('./testingSessionsApi');
vi.mock('../players/playersApi');
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'coach-uid' } }) }));
vi.mock('./StartSessionCard', () => ({
  StartSessionCard: ({ onStarted, starting }: { onStarted: (id: string) => void; starting?: boolean }) => (
    <>
      <button onClick={() => onStarted('session-new')}>Start new session</button>
      {starting && <div>start-sheet-open</div>}
    </>
  ),
}));
vi.mock('./LiveSessionView', () => ({
  LiveSessionView: ({
    session,
    players,
    onSessionClosed,
  }: {
    session: { id: string };
    players: { fullName: string }[];
    onSessionClosed: () => void;
  }) => (
    <div>
      <span>Live: {session.id}</span>
      <span>Roster: {players.map((p) => p.fullName).join(', ')}</span>
      <button onClick={onSessionClosed}>Close session</button>
    </div>
  ),
}));

function buildTeam(overrides: Partial<Team>): Team {
  return { id: 'team-1', activeTestingSessionId: null, name: 'U17', ...overrides } as Team;
}

const ONE_PLAYER: Player[] = [{ id: 'player-1', number: 7, fullName: 'Jane Doe' } as Player];

// TeamPhysicalSessionTab renders off the `team` PROP, exactly like TeamPage
// will use it (team lives in the parent's state; onTeamChanged asks the
// parent to update and re-render with the new team). This harness mirrors
// that parent so the start/close transitions are tested the way they'll
// really happen, not by asserting on a prop the component doesn't own.
function Harness({ initialTeam, onTeamChanged }: { initialTeam: Team; onTeamChanged: (t: Team) => void }) {
  const [team, setTeam] = useState(initialTeam);
  return (
    <TeamPhysicalSessionTab
      teamId="team-1"
      team={team}
      onTeamChanged={(t) => {
        setTeam(t);
        onTeamChanged(t);
      }}
    />
  );
}

describe('TeamPhysicalSessionTab', () => {
  it('fetches its own roster on mount, rather than depending on the Overview tab having rendered', async () => {
    const listPlayersSpy = vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: ONE_PLAYER, lastDoc: null, hasMore: false });

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} onTeamChanged={vi.fn()} />);

    await waitFor(() => expect(listPlayersSpy).toHaveBeenCalledWith('team-1'));
  });

  it('shows a loading state while the roster is being fetched', async () => {
    let resolvePlayers!: (page: { players: Player[]; lastDoc: null; hasMore: boolean }) => void;
    vi.spyOn(playersApi, 'listPlayers').mockReturnValue(
      new Promise((resolve) => {
        resolvePlayers = resolve;
      })
    );

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} onTeamChanged={vi.fn()} />);

    expect(screen.queryByText('Start new session')).not.toBeInTheDocument();

    resolvePlayers({ players: [], lastDoc: null, hasMore: false });
    await waitFor(() => expect(screen.getByText('Start new session')).toBeInTheDocument());
  });

  it('shows an alert if the roster fails to load', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockRejectedValue(new Error('offline'));

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} onTeamChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('shows the start card when there is no active session', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} onTeamChanged={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Start new session')).toBeInTheDocument());
  });

  it('loads and shows the live view, with the fetched roster, when the team has an active session', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: ONE_PLAYER, lastDoc: null, hasMore: false });
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({ activeTestingSessionId: 'session-1' })} onTeamChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Live: session-1')).toBeInTheDocument());
    expect(screen.getByText('Roster: Jane Doe')).toBeInTheDocument();
  });

  it('switches to the live view after starting a session, and updates the parent team', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-new', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({})} onTeamChanged={onTeamChanged} />);
    await waitFor(() => screen.getByText('Start new session').click());

    await waitFor(() => expect(screen.getByText('Live: session-new')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: 'session-new' }));
  });

  it('switches back to the start card after closing the session', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({ activeTestingSessionId: 'session-1' })} onTeamChanged={onTeamChanged} />);
    await waitFor(() => screen.getByText('Close session').click());

    await waitFor(() => expect(screen.getByText('Start new session')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: null }));
  });

  it('loads every roster page and skips players who left the club', async () => {
    const page1 = Array.from({ length: 25 }, (_, i) => ({ ...ONE_PLAYER[0], id: `p${i}`, fullName: `Player ${i}` }));
    const listPlayersSpy = vi
      .spyOn(playersApi, 'listPlayers')
      .mockResolvedValueOnce({ players: page1, lastDoc: { id: 'p24' } as never, hasMore: true })
      .mockResolvedValueOnce({
        players: [
          { ...ONE_PLAYER[0], id: 'p25', fullName: 'Player 25' },
          { ...ONE_PLAYER[0], id: 'gone', fullName: 'Gone Player', leftClubAt: '2026-09-01' },
        ],
        lastDoc: null,
        hasMore: false,
      });
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({ id: 's-1', date: '2026-10-20', status: 'open' } as never);
    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({ activeTestingSessionId: 's-1' })} onTeamChanged={vi.fn()} />);
    const roster = await screen.findByText(/^Roster:/);
    expect(listPlayersSpy).toHaveBeenLastCalledWith('team-1', { id: 'p24' });
    expect(roster).toHaveTextContent('Player 0');
    expect(roster).toHaveTextContent('Player 25');
    expect(roster).not.toHaveTextContent('Gone Player');
  });

  it('New testing session in the toolbar opens the start sheet', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: [], lastDoc: null, hasMore: false });
    render(
      <WithChrome>
        <TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} onTeamChanged={vi.fn()} />
      </WithChrome>
    );
    expect(screen.queryByText('start-sheet-open')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'New testing session' }));
    expect(screen.getByText('start-sheet-open')).toBeInTheDocument();
  });

  it('an active session publishes no main action', async () => {
    vi.spyOn(playersApi, 'listPlayers').mockResolvedValue({ players: ONE_PLAYER, lastDoc: null, hasMore: false });
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({ id: 's-1', date: '2026-10-20', status: 'open' } as never);
    render(
      <WithChrome>
        <TeamPhysicalSessionTab teamId="team-1" team={buildTeam({ activeTestingSessionId: 's-1' })} onTeamChanged={vi.fn()} />
      </WithChrome>
    );
    await screen.findByText('Live: s-1');
    expect(screen.queryByRole('button', { name: 'New testing session' })).not.toBeInTheDocument();
  });
});
