import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerRosterPicker } from './PlayerRosterPicker';
import { useAuth } from '../auth/AuthContext';
import { authValue, testClub } from '../test/authValue';
import type { Player } from '../types/player';
import type { TestingSessionEntry } from '../types/testingSession';

vi.mock('../auth/AuthContext');

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
  const players = [
    buildPlayer({ id: 'player-1', number: 7, fullName: 'Jane Doe' }),
    buildPlayer({ id: 'player-2', number: 9, fullName: 'Mia Lopez' }),
  ];

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(authValue());
  });

  it('counts out of seven qualities when growth tests are off', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ growthTestsEnabled: false }) }));
    render(<PlayerRosterPicker players={players} entries={[buildEntry({})]} selectedPlayerId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Jane Doe/ })).toHaveTextContent('1/7');
  });

  it('does not count a legacy growth entry when growth tests are off', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ club: testClub({ growthTestsEnabled: false }) }));
    const entries = [buildEntry({}), buildEntry({ id: 'player-1__growth', testType: 'growth' })];
    render(<PlayerRosterPicker players={players} entries={entries} selectedPlayerId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Jane Doe/ })).toHaveTextContent('1/7');
  });

  it('shows the whole roster right away, each with a completed-quality count', () => {
    render(<PlayerRosterPicker players={players} entries={[buildEntry({})]} selectedPlayerId={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Jane Doe/ })).toHaveTextContent('1/8');
    expect(screen.getByRole('button', { name: /Mia Lopez/ })).toHaveTextContent('0/8');
  });

  it('filters the list by search text without hiding it', () => {
    render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'mia' } });
    expect(screen.queryByRole('button', { name: /Jane Doe/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mia Lopez/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search players'), { target: { value: 'zzz' } });
    expect(screen.getByText('No players match.')).toBeInTheDocument();
  });

  it('selects a player on tap and marks the selected row', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Mia Lopez/ }));
    expect(onSelect).toHaveBeenCalledWith('player-2');
    rerender(<PlayerRosterPicker players={players} entries={[]} selectedPlayerId="player-2" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: /Mia Lopez/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('explains an empty team instead of showing a bare search box', () => {
    render(<PlayerRosterPicker players={[]} entries={[]} selectedPlayerId={null} onSelect={vi.fn()} />);
    expect(screen.getByText('No players in this team yet. Add them in the Roster tab.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Search players')).not.toBeInTheDocument();
  });
});
