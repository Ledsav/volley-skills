import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSessionView } from './LiveSessionView';
import * as testingSessionsApi from './testingSessionsApi';
import type { Player } from '../types/player';
import type { TestingSession } from '../types/testingSession';

vi.mock('./testingSessionsApi');
vi.mock('./QualityTileGrid', () => ({
  QualityTileGrid: ({
    playerId,
    playerName,
    onEntryChanged,
  }: {
    playerId: string;
    playerName: string;
    onEntryChanged: () => void;
  }) => (
    <div>
      <span>Qualities for {playerId} ({playerName})</span>
      <button onClick={onEntryChanged}>Simulate entry changed</button>
    </div>
  ),
}));

const SESSION: TestingSession = { id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null };
const PLAYERS: Player[] = [{ id: 'player-1', number: 7, fullName: 'Jane Doe' } as Player];

describe('LiveSessionView', () => {
  it('loads entries on mount and shows the quality grid once a player is selected', async () => {
    vi.spyOn(testingSessionsApi, 'getEntries').mockResolvedValue([]);

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={vi.fn()} />);

    await waitFor(() => expect(testingSessionsApi.getEntries).toHaveBeenCalledWith('team-1', 'session-1'));
    fireEvent.focus(screen.getByLabelText('Search players'));
    fireEvent.mouseDown(screen.getByText('Jane Doe'));

    expect(screen.getByText('Qualities for player-1 (Jane Doe)')).toBeInTheDocument();
  });

  it('closes the session after confirmation', async () => {
    vi.spyOn(testingSessionsApi, 'getEntries').mockResolvedValue([]);
    const closeSpy = vi.spyOn(testingSessionsApi, 'closeSession').mockResolvedValue(undefined);
    const onSessionClosed = vi.fn();

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={onSessionClosed} />);
    await waitFor(() => expect(testingSessionsApi.getEntries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, close' }));

    await waitFor(() => expect(closeSpy).toHaveBeenCalledWith('team-1', 'session-1'));
    expect(onSessionClosed).toHaveBeenCalled();
  });

  it('refetches entries when QualityTileGrid reports an entry changed', async () => {
    const getEntriesSpy = vi.spyOn(testingSessionsApi, 'getEntries').mockResolvedValue([]);

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={vi.fn()} />);

    await waitFor(() => expect(getEntriesSpy).toHaveBeenCalledTimes(1));
    fireEvent.focus(screen.getByLabelText('Search players'));
    fireEvent.mouseDown(screen.getByText('Jane Doe'));

    fireEvent.click(screen.getByRole('button', { name: 'Simulate entry changed' }));

    await waitFor(() => expect(getEntriesSpy).toHaveBeenCalledTimes(2));
  });
});
