import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamPhysicalSessionTab } from './TeamPhysicalSessionTab';
import * as testingSessionsApi from './testingSessionsApi';
import type { Team } from '../types/team';

vi.mock('./testingSessionsApi');
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ firebaseUser: { uid: 'coach-uid' } }) }));
vi.mock('./StartSessionCard', () => ({
  StartSessionCard: ({ onStarted }: { onStarted: (id: string) => void }) => (
    <button onClick={() => onStarted('session-new')}>Start new session</button>
  ),
}));
vi.mock('./LiveSessionView', () => ({
  LiveSessionView: ({ session, onSessionClosed }: { session: { id: string }; onSessionClosed: () => void }) => (
    <div>
      <span>Live: {session.id}</span>
      <button onClick={onSessionClosed}>Close session</button>
    </div>
  ),
}));

function buildTeam(overrides: Partial<Team>): Team {
  return { id: 'team-1', activeTestingSessionId: null, name: 'U17', ...overrides } as Team;
}

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
      players={[]}
      onTeamChanged={(t) => {
        setTeam(t);
        onTeamChanged(t);
      }}
    />
  );
}

describe('TeamPhysicalSessionTab', () => {
  it('shows the start card when there is no active session', () => {
    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({})} players={[]} onTeamChanged={vi.fn()} />);
    expect(screen.getByText('Start new session')).toBeInTheDocument();
  });

  it('loads and shows the live view when the team has an active session', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });

    render(<TeamPhysicalSessionTab teamId="team-1" team={buildTeam({ activeTestingSessionId: 'session-1' })} players={[]} onTeamChanged={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Live: session-1')).toBeInTheDocument());
  });

  it('switches to the live view after starting a session, and updates the parent team', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-new', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({})} onTeamChanged={onTeamChanged} />);
    screen.getByText('Start new session').click();

    await waitFor(() => expect(screen.getByText('Live: session-new')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: 'session-new' }));
  });

  it('switches back to the start card after closing the session', async () => {
    vi.spyOn(testingSessionsApi, 'getSession').mockResolvedValue({
      id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null,
    });
    const onTeamChanged = vi.fn();

    render(<Harness initialTeam={buildTeam({ activeTestingSessionId: 'session-1' })} onTeamChanged={onTeamChanged} />);
    await waitFor(() => screen.getByText('Close session').click());

    await waitFor(() => expect(screen.getByText('Start new session')).toBeInTheDocument());
    expect(onTeamChanged).toHaveBeenCalledWith(expect.objectContaining({ activeTestingSessionId: null }));
  });
});
