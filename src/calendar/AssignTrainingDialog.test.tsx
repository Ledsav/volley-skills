import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssignTrainingDialog } from './AssignTrainingDialog';
import * as calendarApi from './calendarApi';
import * as trainingsApi from '../trainings/trainingsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('./calendarApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../exercises/exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../diagrams/DiagramThumbnail', () => ({
  DiagramThumbnail: ({ exerciseId }: { exerciseId: string }) => (
    <div data-testid="diagram-thumb" data-exercise-id={exerciseId} />
  ),
}));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: '',
  ageGroupTarget: 'U17',
  exercises: [
    { exerciseId: 'ex-1', order: 1, durationMinutes: 12 },
    { exerciseId: 'ex-2', order: 2, durationMinutes: 8 },
  ],
  exerciseIds: ['ex-1', 'ex-2'],
  createdBy: 'x',
  createdAt: null,
};

const exOne = {
  id: 'ex-1',
  name: 'Pepper',
  description: 'Two players, controlled rally.',
  category: 'warmup' as const,
  createdBy: 'x',
  createdAt: null,
};
const exTwo = {
  id: 'ex-2',
  name: 'Serve targets',
  description: '',
  category: 'service' as const,
  createdBy: 'x',
  createdAt: null,
};

describe('AssignTrainingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never }));
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null, hasMore: false });
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([exOne, exTwo]);
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

  it('pages the training picker with Load more', async () => {
    const page2Training = { ...training, id: 't-2', businessId: 'TR-0042', name: 'Blocking drills' };
    const page1LastDoc = { id: 'cursor-1' } as never;
    vi.mocked(trainingsApi.listTrainings)
      .mockReset()
      .mockResolvedValueOnce({ trainings: [training], lastDoc: page1LastDoc, hasMore: true })
      .mockResolvedValueOnce({ trainings: [page2Training], lastDoc: null, hasMore: false });

    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    await screen.findByLabelText(/Passing circuit/);
    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(trainingsApi.listTrainings).toHaveBeenCalledWith(page1LastDoc));
    fireEvent.click(await screen.findByLabelText(/Blocking drills/));
    expect((screen.getByLabelText(/Blocking drills/) as HTMLInputElement).checked).toBe(true);
    await screen.findByRole('list', { name: 'Training exercises' });
  });

  it('surfaces an alert instead of the empty state when the training list fails to load', async () => {
    vi.mocked(trainingsApi.listTrainings).mockReset().mockRejectedValueOnce(new Error('permission-denied'));
    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load trainings/i);
    expect(screen.queryByText('No trainings available.')).not.toBeInTheDocument();
  });

  it('shows the selected training\'s exercises, expandable to their full description', async () => {
    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(await screen.findByLabelText(/Passing circuit/));

    const list = await screen.findByRole('list', { name: 'Training exercises' });
    expect(within(list).getByText('Pepper')).toBeInTheDocument();
    expect(within(list).getByText('Serve targets')).toBeInTheDocument();
    expect(within(list).queryByText('Two players, controlled rally.')).not.toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'Expand Pepper' }));
    expect(within(list).getByText('Two players, controlled rally.')).toBeInTheDocument();
  });

  it('blocks assigning when no training is selected', async () => {
    const createSpy = vi.mocked(calendarApi.createCalendarSession).mockResolvedValue('s-1');
    render(<AssignTrainingDialog teamId="team-1" date="2026-09-12" onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.click(screen.getByText('Assign'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
