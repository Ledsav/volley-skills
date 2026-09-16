import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QualityTileGrid } from './QualityTileGrid';
import type { TestingSessionEntry } from '../types/testingSession';

vi.mock('./SessionQualityPanel', () => ({
  SessionQualityPanel: ({ testType, onClose }: { testType: string; onClose: () => void }) => (
    <div>
      <span>Panel for {testType}</span>
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
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('Not started').length).toBe(6);
  });

  it('opens the recording panel for the tapped quality', () => {
    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        entriesByPlayerAndType={new Map()}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.getByText('Panel for sprint10m')).toBeInTheDocument();
  });

  it('does not reopen a quality that is already Done, to avoid recording a duplicate result', () => {
    const entries = new Map([['player-1__sprint10m', buildEntry({ id: 'player-1__sprint10m', testType: 'sprint10m', status: 'complete' })]]);

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        entriesByPlayerAndType={entries}
        recordedByUid="coach-uid"
        onEntryChanged={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /10m Sprint/ }));

    expect(screen.queryByText('Panel for sprint10m')).not.toBeInTheDocument();
  });

  it('refetches entries when the panel is closed without finishing, so a stale draft is never shown next reopen', () => {
    const onEntryChanged = vi.fn();

    render(
      <QualityTileGrid
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
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
