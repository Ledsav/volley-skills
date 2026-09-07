import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import * as calendarApi from './calendarApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./calendarApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: '',
  ageGroupTarget: 'U17',
  exercises: [],
  exerciseIds: [],
  createdBy: 'x',
  createdAt: null,
};

describe('AssignTrainingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null });
  });

  it('creates a session with the picked training denormalized onto it', async () => {
    const createSpy = vi.mocked(calendarApi.createCalendarSession).mockResolvedValue('s-1');
    const onSaved = vi.fn();

    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.click(await screen.findByLabelText(/Passing circuit/));
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Serve receive focus' } });
    fireEvent.click(screen.getByText('Assign'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      'team-1',
      {
        date: '2026-09-12',
        trainingId: 't-1',
        trainingBusinessId: 'TR-0007',
        trainingName: 'Passing circuit',
        notes: 'Serve receive focus',
      },
      'coach-uid'
    );
  });

  it('blocks assigning when no training is selected', async () => {
    const createSpy = vi.mocked(calendarApi.createCalendarSession).mockResolvedValue('s-1');
    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText('Assign'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
