import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingBuilderDialog } from './TrainingBuilderDialog';
import * as trainingsApi from './trainingsApi';
import * as exercisesApi from '../exercises/exercisesApi';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('./trainingsApi');
vi.mock('../exercises/exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../diagrams/DiagramThumbnail', () => ({
  DiagramThumbnail: ({ exerciseId }: { exerciseId: string }) => (
    <div data-testid="diagram-thumb" data-exercise-id={exerciseId} />
  ),
}));

const exOne = { id: 'ex-1', name: 'Pepper', description: 'Two players, controlled rally.', category: 'warmup' as const, createdBy: 'x', createdAt: null };
const exTwo = { id: 'ex-2', name: 'Serve targets', description: '', category: 'service' as const, createdBy: 'x', createdAt: null };

const addBtn = (name: string) => screen.getByRole('button', { name: `Add ${name}` });

describe('TrainingBuilderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never }));
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exOne, exTwo], lastDoc: null, hasMore: false });
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([]);
  });

  it('builds a new training with ordered exercises and recomputed order + exerciseIds', async () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Passing circuit' } });
    fireEvent.change(screen.getByLabelText('Age group target'), { target: { value: 'U17' } });

    fireEvent.click(screen.getByText('Add exercise'));
    await screen.findByRole('button', { name: 'Add Pepper' });
    fireEvent.click(addBtn('Pepper'));
    fireEvent.click(addBtn('Serve targets'));

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
    await screen.findByRole('button', { name: 'Add Pepper' });
    fireEvent.click(addBtn('Pepper'));
    fireEvent.click(addBtn('Serve targets'));

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

  it('paginates the exercise picker with Load more', async () => {
    const exThree = {
      id: 'ex-3',
      name: 'Block footwork',
      description: '',
      category: 'defense' as const,
      createdBy: 'x',
      createdAt: null,
    };
    const firstPageLastDoc = { id: 'cursor-1' } as never;
    vi.mocked(exercisesApi.listExercises)
      .mockResolvedValueOnce({ exercises: [exOne, exTwo], lastDoc: firstPageLastDoc, hasMore: true })
      .mockResolvedValueOnce({ exercises: [exThree], lastDoc: null, hasMore: false });
    const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });

    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));
    await screen.findByRole('button', { name: 'Add Pepper' });
    expect(screen.queryByText('Block footwork')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Load more'));

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(firstPageLastDoc, null));

    fireEvent.click(await screen.findByRole('button', { name: 'Add Block footwork' }));

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(createSpy.mock.calls[0][0].exercises).toEqual([{ exerciseId: 'ex-3', order: 1, durationMinutes: 10 }])
    );
  });

  it('surfaces an alert when the edit-mode exercise lookup fails', async () => {
    vi.mocked(exercisesApi.getExercisesByIds).mockReset().mockRejectedValueOnce(new Error('permission-denied'));
    render(
      <TrainingBuilderDialog
        training={{
          id: 't-1',
          businessId: 'TR-0007',
          name: 'Circuit',
          description: '',
          ageGroupTarget: 'U17',
          exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 10 }],
          exerciseIds: ['ex-1'],
          createdBy: 'x',
          createdAt: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load the exercises for this training/i);
  });

  it('surfaces an alert when opening the exercise picker fails', async () => {
    vi.mocked(exercisesApi.listExercises).mockReset().mockRejectedValueOnce(new Error('permission-denied'));
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load exercises to pick from/i);
  });

  it('removes a row', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });
    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Pepper' }));

    const list = screen.getByRole('list', { name: 'Training exercises' });
    expect(within(list).getByText('Pepper')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove exercise 1'));
    expect(within(list).queryByText('Pepper')).not.toBeInTheDocument();
  });

  it('filters the picker by category and resets pagination', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));
    await screen.findByRole('button', { name: 'Add Pepper' });
    expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, null);

    fireEvent.click(screen.getByRole('button', { name: 'Service', pressed: false }));

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'service'));
    expect(screen.getByRole('button', { name: 'Service', pressed: true })).toBeInTheDocument();
  });

  it('expands a picker row to show its full description and a thumbnail', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));
    const expand = await screen.findByRole('button', { name: 'Expand Pepper' });
    fireEvent.click(expand);

    expect(screen.getByRole('button', { name: 'Collapse Pepper' })).toBeInTheDocument();
    expect(screen.getByText('Two players, controlled rally.')).toBeInTheDocument();
    expect(screen.getByTestId('diagram-thumb')).toHaveAttribute('data-exercise-id', 'ex-1');
  });

  it('keeps the picker open after adding so several exercises can be picked', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Pepper' }));

    expect(screen.getByRole('button', { name: 'Add Serve targets' })).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Training exercises' })).getByText('Pepper')).toBeInTheDocument();
  });
});
