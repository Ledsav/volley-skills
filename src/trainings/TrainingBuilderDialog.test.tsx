import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';
import * as trainingsApi from './trainingsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./trainingsApi');
vi.mock('../exercises/exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const exOne = { id: 'ex-1', name: 'Pepper', description: '', category: 'warmup' as const, createdBy: 'x', createdAt: null };
const exTwo = { id: 'ex-2', name: 'Serve targets', description: '', category: 'service' as const, createdBy: 'x', createdAt: null };

describe('TrainingBuilderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exOne, exTwo], lastDoc: null });
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([]);
  });

  it('builds a new training with ordered exercises and recomputed order + exerciseIds', async () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Passing circuit' } });
    fireEvent.change(screen.getByLabelText('Age group target'), { target: { value: 'U17' } });

    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Serve targets'));

    fireEvent.change(screen.getByLabelText('Duration for exercise 1 (min)'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Duration for exercise 2 (min)'), { target: { value: '18' } });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        {
          name: 'Passing circuit',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [
            { exerciseId: 'ex-1', order: 1, durationMinutes: 12 },
            { exerciseId: 'ex-2', order: 2, durationMinutes: 18 },
          ],
        },
        'coach-uid'
      )
    );
  });

  it('reorders rows so the moved exercise gets the new order on save', async () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Serve targets'));

    fireEvent.click(screen.getByLabelText('Move exercise 2 up'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const exercises = createSpy.mock.calls[0][0].exercises;
      expect(exercises).toEqual([
        { exerciseId: 'ex-2', order: 1, durationMinutes: 10 },
        { exerciseId: 'ex-1', order: 2, durationMinutes: 10 },
      ]);
    });
  });

  it('shows a "Deleted exercise" row when editing a training whose exercise is gone', async () => {
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([exOne]);
    render(
      <TrainingBuilderDialog
        training={{
          id: 't-1',
          businessId: 'TR-0007',
          name: 'Circuit',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [
            { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
            { exerciseId: 'ex-gone', order: 2, durationMinutes: 10 },
          ],
          exerciseIds: ['ex-1', 'ex-gone'],
          createdBy: 'x',
          createdAt: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(await screen.findByText('Pepper')).toBeInTheDocument();
    expect(screen.getByText('⚠ Deleted exercise')).toBeInTheDocument();
  });

  it('removes a row', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByText('Pepper'));

    const list = screen.getByRole('list');
    expect(within(list).getByText('Pepper')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove exercise 1'));
    expect(within(list).queryByText('Pepper')).not.toBeInTheDocument();
  });
});
