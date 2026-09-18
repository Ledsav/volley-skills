import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QualityTileGrid } from './QualityTileGrid';
import type { TestingSessionEntry } from '../types/testingSession';

vi.mock('./SessionQualityPanel', () => ({
  SessionQualityPanel: ({
    testType,
    playerName,
    onClose,
  }: {
    testType: string;
    playerName: string;
    onClose: () => void;
  }) => (
    <div>
      <span>Panel for {testType} ({playerName})</span>
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

function buildEntry(overrides: Partial<TestingSessionEntry>): TestingSessionEntry {
  return {
    id: 'player-1__cmj',
    playerId: 'player-1',
    testType: 'cmj',
    status: 'in_progress',
    data: {},
    resultTestId: null,
    updatedAt: null,
    ...overrides,
  };
}

describe('QualityTileGrid', () => {
  it('shows Not started, In progress, and Done tiles based on entries', () => {
    const entries = new Map<string, TestingSessionEntry>([
      ['player-1__cmj', buildEntry({ status: 'in_progress' })],
      ['player-1__sprint10m', buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'complete' })],
    ]);

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('Not started').length).toBe(6);
  });

  it('gives long single-word labels a hyphenation point so they fit a phone tile', () => {
    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    expect(screen.getByText('Counter­movement Jump')).toBeInTheDocument();
  });

  it('opens the recording panel for the tapped quality', () => {
    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.getByText('Panel for sprint10m (Jane Doe)')).toBeInTheDocument();
  });

  it('does not reopen a quality that is already Done, to avoid recording a duplicate result', () => {
    const entries = new Map([['player-1__sprint10m', buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'complete' })]]);

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.queryByText('Panel for sprint10m (Jane Doe)')).not.toBeInTheDocument();
  });

  it('passes the selected player name through to the recording panel', () => {
    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.getByText('Panel for sprint10m (Jane Doe)')).toBeInTheDocument();
  });

  it('refetches entries when the panel is closed without finishing, so a stale draft is never shown next reopen', () => {
    const onEntryChanged = vi.fn();

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        playerName="Jane Doe"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={onEntryChanged}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));
    fireEvent.click(screen.getByText('Close panel'));

    expect(onEntryChanged).toHaveBeenCalledTimes(1);
  });
});
