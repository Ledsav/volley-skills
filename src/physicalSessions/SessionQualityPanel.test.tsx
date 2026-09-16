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

  it('records the exercise the coach actually selected for a strength test, not the hardcoded default', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);
    const finishSpy = vi.spyOn(testingSessionsApi, 'finishEntry').mockResolvedValue('test-1');
    const onFinished = vi.fn();

    render(
      <SessionQualityPanel
        teamId="team-1"
        sessionId="session-1"
        sessionDate="2026-09-16"
        playerId="player-1"
        testType="strength"
        entry={null}
        recordedByUid="coach-uid"
        onClose={vi.fn()}
        onFinished={onFinished}
      />
    );

    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: 'squat' } });
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '80' } });
    fireEvent.blur(screen.getByLabelText('Weight (kg)'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(onFinished).toHaveBeenCalled());
    expect(finishSpy).toHaveBeenCalledWith(
      'team-1',
      'session-1',
      'player-1',
      'strength',
      expect.objectContaining({ exercise: 'squat' }),
      'coach-uid'
    );
  });

  it('disables Finish while finishEntry is in flight, to prevent a double-tap creating a duplicate permanent test', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);
    let resolveFinish!: (id: string) => void;
    const finishSpy = vi.spyOn(testingSessionsApi, 'finishEntry').mockReturnValue(
      new Promise((resolve) => {
        resolveFinish = resolve;
      })
    );
    const onFinished = vi.fn();

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
        onFinished={onFinished}
      />
    );

    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText('Body mass (kg)'), { target: { value: '55' } });

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(finishSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(finishSpy).toHaveBeenCalledTimes(1);

    resolveFinish('test-1');
    await waitFor(() => expect(onFinished).toHaveBeenCalled());
  });

  it('re-enables Finish and warns about a possibly-partial save when finishEntry rejects', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    vi.spyOn(testingSessionsApi, 'saveEntryProgress').mockResolvedValue(undefined);
    vi.spyOn(testingSessionsApi, 'finishEntry').mockRejectedValue(new Error('network down'));

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
    fireEvent.change(screen.getByLabelText('Body mass (kg)'), { target: { value: '55' } });

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Finish' })).toBeEnabled());
    expect(screen.getByRole('alert')).toHaveTextContent(/already|partial|check the player card/i);
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
