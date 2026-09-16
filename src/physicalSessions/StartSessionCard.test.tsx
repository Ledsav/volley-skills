import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StartSessionCard } from './StartSessionCard';
import * as testingSessionsApi from './testingSessionsApi';

vi.mock('./testingSessionsApi');

describe('StartSessionCard', () => {
  it('lists past closed sessions on mount', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([
      { id: 'session-old', date: '2026-09-10', status: 'closed', createdBy: 'coach-uid', createdAt: null, closedAt: null },
    ]);

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('2026-09-10')).toBeInTheDocument());
  });

  it('starts a new session with the chosen date and notifies the parent', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    const startSpy = vi.spyOn(testingSessionsApi, 'startSession').mockResolvedValue('session-new');
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(startSpy).toHaveBeenCalledWith('team-1', '2026-09-16', 'coach-uid'));
    expect(onStarted).toHaveBeenCalledWith('session-new');
  });

  it('shows an error and does not call onStarted when starting fails', async () => {
    vi.spyOn(testingSessionsApi, 'listPastSessions').mockResolvedValue([]);
    vi.spyOn(testingSessionsApi, 'startSession').mockRejectedValue(new Error('A testing session is already open for this team.'));
    const onStarted = vi.fn();

    render(<StartSessionCard teamId="team-1" creatorUid="coach-uid" onStarted={onStarted} />);
    await waitFor(() => expect(testingSessionsApi.listPastSessions).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('A testing session is already open for this team.'));
    expect(onStarted).not.toHaveBeenCalled();
  });
});
