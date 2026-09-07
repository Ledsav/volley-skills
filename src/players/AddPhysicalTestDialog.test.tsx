import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddPhysicalTestDialog } from './AddPhysicalTestDialog';
import * as physicalTestsApi from './physicalTestsApi';

vi.mock('./physicalTestsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('AddPhysicalTestDialog', () => {
  it('submits a growth entry', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');
    const onSaved = vi.fn();

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="growth" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={onSaved} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Height (cm)'), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText('Body mass (kg)'), { target: { value: '50' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith(
      'team-1',
      'player-1',
      { testType: 'growth', heightCm: 160, bodyMassKg: 50, date: '2026-09-07', notes: '' },
      'coach-uid'
    );
  });

  it('submits a CMJ entry with the computed best', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="cmj" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 1'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 2'), { target: { value: '34' } });
    fireEvent.change(screen.getByLabelText('Attempt (cm) 3'), { target: { value: '32' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'cmj', attemptsCm: [30, 34, 32], bestCm: 34, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it("submits an approach jump entry matching the coach's worked example", async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="approachJump" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Standing reach (cm)'), { target: { value: '222' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 1'), { target: { value: '260' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 2'), { target: { value: '267' } });
    fireEvent.change(screen.getByLabelText('Touch attempt (cm) 3'), { target: { value: '265' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        {
          testType: 'approachJump',
          standingReachCm: 222,
          attemptsTouchCm: [260, 267, 265],
          bestTouchCm: 267,
          approachJumpCm: 45,
          date: '2026-09-07',
          notes: '',
        },
        'coach-uid'
      )
    );
  });

  it('submits a 10m sprint entry with the computed best (min)', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="sprint10m" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Attempt (s) 1'), { target: { value: '1.85' } });
    fireEvent.change(screen.getByLabelText('Attempt (s) 2'), { target: { value: '1.79' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'sprint10m', attemptsSeconds: [1.85, 1.79], bestSeconds: 1.79, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it('submits a 5-10-5 shuttle entry with separate right/left times', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="shuttle5105" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Right-first (s)'), { target: { value: '5.12' } });
    fireEvent.change(screen.getByLabelText('Left-first (s)'), { target: { value: '5.48' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'shuttle5105', rightFirstSeconds: 5.12, leftFirstSeconds: 5.48, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });

  it('submits a reaction entry with the discard-extremes average and ms conversion', async () => {
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="reaction" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 1'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 2'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 3'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 4'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Drop attempt (cm) 5'), { target: { value: '30' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(spy).toHaveBeenCalled());
    const [, , payload] = spy.mock.calls[0];
    expect(payload).toMatchObject({ testType: 'reaction', averageCm: 20 });
    expect((payload as { reactionTimeMs: number }).reactionTimeMs).toBeCloseTo(201.93, 1);
  });

  it('submits a weighted strength entry with the body-mass ratio from the latest growth entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue({
      id: 'growth-1',
      testType: 'growth',
      heightCm: 160,
      bodyMassKg: 50,
      date: '2026-08-01',
      notes: '',
      recordedBy: 'coach-uid',
      createdAt: null,
    });
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="strength" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    await screen.findByText(/Body-mass ratio needs/);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Weight (kg)'), { target: { value: '55' } });
    await screen.findByText('Body-mass ratio: 1.10');
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        {
          testType: 'strength',
          mode: 'weighted',
          exercise: 'trapBarDeadlift',
          weightKg: 55,
          reps6RM: 6,
          bodyMassRatio: 1.1,
          date: '2026-09-07',
          notes: '',
        },
        'coach-uid'
      )
    );
  });

  it('submits a bodyweight strength entry', async () => {
    vi.spyOn(physicalTestsApi, 'getLatestByType').mockResolvedValue(null);
    const spy = vi.spyOn(physicalTestsApi, 'createPhysicalTest').mockResolvedValue('test-1');

    render(
      <AddPhysicalTestDialog teamId="team-1" playerId="player-1" testType="strength" recordedByUid="coach-uid" onClose={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-07' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'bodyweight' } });
    fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '25' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        'team-1',
        'player-1',
        { testType: 'strength', mode: 'bodyweight', exercise: 'pushUps', reps: 25, date: '2026-09-07', notes: '' },
        'coach-uid'
      )
    );
  });
});
