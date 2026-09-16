import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionQualityPanel } from './SessionQualityPanel';
import * as testingSessionsApi from './testingSessionsApi';
import * as physicalTestsApi from '../players/physicalTestsApi';

vi.mock('./testingSessionsApi');
vi.mock('../players/physicalTestsApi');

describe('SessionQualityPanel', () => {
  it('adds attempts one at a time, persisting each addition, and finishes once ready', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const saveSpy = vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);
    const finishSpy = vi.spyOn(testingSessionsApi, 'finishEntry').mockResolvedValue('test-1');
    const onFinished = vi.fn();

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="cmj"
        entry={null}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={onFinished}
      />
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();

    for (const value of ['30', '34', '32']) {
      fireEvent.change(screen.getByLabelText('New attempt (cm)'), { target: { value } });
      fireEvent.click(screen.getByRole('button', { name: '+ Add attempt' }));
    }

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(3));
    expect(saveSpy).toHaveBeenLastCalledWith(
      'team-1',
      'session-1',
      'player-1',
      'cmj',
      expect.objectContaining({ cmjAttempts: [30, 34, 32] })
    );

    expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(finishSpy).toHaveBeenCalledWith(
      'team-1',
      'session-1',
      'player-1',
      'cmj',
      { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-16', notes: '' },
      'coach-uid'
    );
  });

  it('resumes from an existing draft entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="cmj"
        entry={{
          id: 'player-1__cmj',
          playerId: 'player-1',
          testType: 'cmj',
          status: 'in_progress',
          data: { cmjAttempts: [30] },
          resultTestId: null,
          updatedAt: null,
        }}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={vi.fn()}
      />
    );

    expect(screen.getByText('30 cm')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
  });

  it('persists a single-value field on blur, for a non-attempts quality', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const saveSpy = vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="growth"
        entry={null}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.blur(screen.getByLabelText('Height (cm)'));

    await waitFor(() =>
      expect(saveSpy).toHaveBeenCalledWith(
        'team-1',
        'session-1',
        'player-1',
        'growth',
        expect.objectContaining({ heightCm: '160' })
      )
    );
  });
});
