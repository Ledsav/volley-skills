import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LiveSessionView } from './LiveSessionView';
import * as testingSessionsApi from './testingSessionsApi';
import type { Player } from '../types/player';
import type { TestingSession, TestingSessionEntry } from '../types/testingSession';

vi.mock('./testingSessionsApi');
vi.mock('./QualityTileGrid', () => ({
  QualityTileGrid: ({
    playerId,
    playerName,
    entriesByPlayerAndType,
  }: {
    playerId: string;
    playerName: string;
    entriesByPlayerAndType: Map<string, unknown>;
  }) => (
    <div>
      <span>Qualities for {playerId} ({playerName})</span>
      <span>{entriesByPlayerAndType.size} entries</span>
    </div>
  ),
}));

const SESSION: TestingSession = { id: 'session-1', date: '2026-09-16', status: 'open', createdBy: 'coach-uid', createdAt: null, closedAt: null };
const PLAYERS: Player[] = [{ id: 'player-1', number: 7, fullName: 'Jane Doe' } as Player];

type EntriesListener = (entries: TestingSessionEntry[]) => void;

function mockEntriesListener() {
  const listener: { emit: EntriesListener } = { emit: () => undefined };
  const unsubscribe = vi.fn();
  vi.spyOn(testingSessionsApi, 'subscribeEntries').mockImplementation((_t, _s, onChange) => {
    listener.emit = onChange;
    onChange([]);
    return unsubscribe;
  });
  return { listener, unsubscribe };
}

describe('LiveSessionView', () => {
  it('loads entries on mount and shows the quality grid once a player is selected', async () => {
    mockEntriesListener();

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={vi.fn()} />);

    await waitFor(() => expect(testingSessionsApi.subscribeEntries).toHaveBeenCalledWith('team-1', 'session-1', expect.any(Function), expect.any(Function)));
    fireEvent.focus(screen.getByLabelText('Search players'));
    fireEvent.mouseDown(screen.getByText('Jane Doe'));

    expect(screen.getByText('Qualities for player-1 (Jane Doe)')).toBeInTheDocument();
  });

  it('closes the session after confirmation', async () => {
    mockEntriesListener();
    const closeSpy = vi.spyOn(testingSessionsApi, 'closeSession').mockResolvedValue(undefined);
    const onSessionClosed = vi.fn();

    render(<LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={onSessionClosed} />);
    await waitFor(() => expect(testingSessionsApi.subscribeEntries).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, close' }));

    await waitFor(() => expect(closeSpy).toHaveBeenCalledWith('team-1', 'session-1'));
    expect(onSessionClosed).toHaveBeenCalled();
  });

  it('shows entry updates from the listener without re-reading, and unsubscribes on unmount', async () => {
    const { listener, unsubscribe } = mockEntriesListener();

    const { unmount } = render(
      <LiveSessionView teamId="team-1" session={SESSION} players={PLAYERS} recordedByUid="coach-uid" onSessionClosed={vi.fn()} />
    );
    fireEvent.focus(screen.getByLabelText('Search players'));
    fireEvent.mouseDown(screen.getByText('Jane Doe'));
    expect(screen.getByText('0 entries')).toBeInTheDocument();

    act(() =>
      listener.emit([
        { id: 'player-1__cmj', playerId: 'player-1', testType: 'cmj', status: 'complete', data: {}, resultTestId: 't1', updatedAt: null },
      ])
    );

    expect(screen.getByText('1 entries')).toBeInTheDocument();
    expect(testingSessionsApi.subscribeEntries).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
