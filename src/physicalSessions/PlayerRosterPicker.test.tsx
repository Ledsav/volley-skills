import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import type { Player } from '../types/player';
import type { TestingSessionEntry } from '../types/testingSession';

function buildPlayer(overrides: Partial<Player>): Player {
  return { id: 'player-1', number: 7, fullName: 'Jane Doe', ...overrides } as Player;
}

function buildEntry(overrides: Partial<TestingSessionEntry>): TestingSessionEntry {
  return {
    id: 'player-1__cmj',
    playerId: 'player-1',
    testType: 'cmj',
    status: 'complete',
    data: {},
    resultTestId: 'test-1',
    updatedAt: null,
    ...overrides,
  };
}

describe('PlayerRosterPicker', () => {
  it('shows every player with a completed-quality-count chip', () => {
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' }), buildPlayer({ id: 'player-2', fullName: 'Amy Lee', number: 9 })];
    const entries = [buildEntry({ status: 'complete' }), buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'in_progress' })];

    render(<PlayerRosterPicker players={players} entries={entries} selectedPlayerId={null} onSelect={vi.fn()} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('1/8')).toBeInTheDocument();
    expect(screen.getByText('0/8')).toBeInTheDocument();
  });

  it('filters by search text', () => {
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' }), buildPlayer({ id: 'player-2', fullName: 'Amy Lee', number: 9 })];

    render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'amy' } });

    expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Amy Lee')).toBeInTheDocument();
  });

  it('calls onSelect when a player row is tapped', () => {
    const onSelect = vi.fn();
    const players = [buildPlayer({ id: 'player-1', fullName: 'Jane Doe' })];

    render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Jane Doe'));

    expect(onSelect).toHaveBeenCalledWith('player-1');
  });
});
