process.env.TZ = 'Europe/Rome';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { StartSessionCard } from './StartSessionCard';
import * as testingSessionsApi from './testingSessionsApi';

vi.mock('./testingSessionsApi');
vi.mock('./PastSessionDialog', () => ({
  PastSessionDialog: ({ session, onDeleted }: { session: { date: string }; onDeleted: () => void }) => (
    <div role="dialog">
      results for {session.date}
      <button onClick={onDeleted}>delete-stub</button>
    </div>
  ),
}));

describe('StartSessionCard', () => {
  it('lists past closed sessions on mount', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([
      { id: 'session-old', date: '2026-09-10', status: 'closed', createdBy: 'coach-uid', createdAt: null, closedAt: null },
    ]);

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('10 Sep 2026')).toBeInTheDocument());
  });

  it('starts a new session with the chosen date and notifies the parent', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    const startSpy = vi.spyOn(testingSessionsApi, 'startSession').mockResolvedValue('session-new');
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} starting />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('team-1', '2026-09-16', 'coach-uid'));
    expect(onStarted).toHaveBeenCalledWith('session-new');
  });

  it('shows an error and does not call onStarted when starting fails', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    vi.spyOn(testingSessionsApi, 'startSession').mockRejectedValue(new testingSessionsApi.SessionAlreadyOpenError());
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} starting />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A testing session is already open for this team.'));
    expect(onStarted).not.toHaveBeenCalled();
  });

  it('opens a past session to see its results', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([
      { id: 'session-old', date: '2026-09-10', status: 'closed', createdBy: 'coach-uid', createdAt: null, closedAt: null },
    ]);
    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /10 Sep 2026/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('results for 2026-09-10');
  });

  it('removes a deleted session from the list', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([
      { id: 'session-old', date: '2026-09-10', status: 'closed', createdBy: 'coach-uid', createdAt: null, closedAt: null },
    ]);
    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /10 Sep 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: 'delete-stub' }));
    expect(screen.queryByRole('button', { name: /10 Sep 2026/ })).not.toBeInTheDocument();
    expect(screen.getByText('No sessions yet.')).toBeInTheDocument();
  });
});

describe('StartSessionCard start sheet', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults the start date to the local day just after midnight (B8)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-10-14T22:30:00Z'));
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} starting />);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-15');
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());
  });

  it('starts from the sheet', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    vi.spyOn(testingSessionsApi, 'startSession').mockResolvedValue('session-new');
    const onStarted = vi.fn();
    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} starting onCloseStart={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));
    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('session-new'));
  });
});
