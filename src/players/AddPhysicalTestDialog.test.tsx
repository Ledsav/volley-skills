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
});
