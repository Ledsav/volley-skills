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
vi.mock('../diagrams/diagramsApi', () => ({ listDiagrams: vi.fn().mockResolvedValue([]) }));
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
    expect(screen.getByText('Deleted exercise')).toBeInTheDocument();
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

    fireEvent.click(within(screen.getByRole('group', { name: 'Filter exercises by category' })).getByRole('button', { name: 'Service', pressed: false }));

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'service'));
    expect(within(screen.getByRole('group', { name: 'Filter exercises by category' })).getByRole('button', { name: 'Service', pressed: true })).toBeInTheDocument();
  });

  it('opens an added exercise full-screen and steps to the next one', async () => {
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Circuit' } });

    fireEvent.click(screen.getByText('Add exercise'));
    fireEvent.click(await screen.findByRole('button', { name: 'Add Pepper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Serve targets' }));

    const list = screen.getByRole('list', { name: 'Training exercises' });
    expect(within(list).queryByText('Two players, controlled rally.')).not.toBeInTheDocument();

    fireEvent.click(within(list).getByRole('button', { name: 'View exercise 1: Pepper' }));
    const viewer = screen.getByRole('dialog', { name: 'Pepper' });
    expect(within(viewer).getByText('Two players, controlled rally.')).toBeInTheDocument();
    expect(within(viewer).getByText('Exercise 1 of 2')).toBeInTheDocument();
    expect(await within(viewer).findByText('No diagrams for this exercise.')).toBeInTheDocument();

    fireEvent.click(within(viewer).getByRole('button', { name: 'Next exercise' }));
    expect(screen.getByRole('dialog', { name: 'Serve targets' })).toBeInTheDocument();

    // Escape closes only the viewer, not the training dialog underneath.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Serve targets' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New training' })).toBeInTheDocument();
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

  it('creates the training once even when Save is clicked twice', () => {
    const createSpy = vi.mocked(trainingsApi.createTraining).mockReturnValue(new Promise(() => undefined));
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Passing circuit' } });
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it('offline, a new training explains it needs a connection instead of hanging', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const createSpy = vi.mocked(trainingsApi.createTraining);
    render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Passing circuit' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i);
    expect(createSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('opens a new training prefilled from a draft', async () => {
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([exOne]);
    render(
      <TrainingBuilderDialog
        initial={{ name: 'AI plan', description: 'D', ageGroupTarget: 'U15', exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 15 }] }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'New training' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('AI plan');
    expect(screen.getByLabelText('Age group target')).toHaveValue('U15');
    expect(await screen.findByText('Pepper')).toBeInTheDocument();
    expect(screen.getByText('1 exercise · 15 min')).toBeInTheDocument();
  });
  describe('suggested players and targets', () => {
    const saved = {
      id: 't-9',
      businessId: 'TR-0009',
      name: 'Serve day',
      description: '',
      ageGroupTarget: '',
      exercises: [],
      exerciseIds: [],
      suggestedPlayers: 12,
      targets: ['service' as const],
      createdBy: 'x',
      createdAt: null,
    };
    const targetsGroup = () => screen.getByRole('group', { name: 'Training targets' });

    it('saves suggested players and targets in category order', async () => {
      const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
      render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Serve day' } });
      fireEvent.change(screen.getByLabelText('Suggested players'), { target: { value: '12' } });
      fireEvent.click(within(targetsGroup()).getByRole('button', { name: /Reception/ }));
      fireEvent.click(within(targetsGroup()).getByRole('button', { name: /Service/ }));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(createSpy).toHaveBeenCalled());
      expect(createSpy.mock.calls[0][0]).toMatchObject({ suggestedPlayers: 12, targets: ['service', 'reception'] });
    });

    it('sends neither field when nothing is set', async () => {
      const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
      render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Plain' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(createSpy).toHaveBeenCalled());
      const input = createSpy.mock.calls[0][0];
      expect(input.suggestedPlayers).toBeUndefined();
      expect(input.targets).toBeUndefined();
    });

    it('clears both fields on a training that had them', async () => {
      const updateSpy = vi.mocked(trainingsApi.updateTraining).mockResolvedValue(undefined);
      render(<TrainingBuilderDialog training={saved} onClose={vi.fn()} onSaved={vi.fn()} />);
      expect(screen.getByLabelText('Suggested players')).toHaveValue(12);
      fireEvent.change(screen.getByLabelText('Suggested players'), { target: { value: '' } });
      fireEvent.click(within(targetsGroup()).getByRole('button', { name: /Service/ }));
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() => expect(updateSpy).toHaveBeenCalled());
      expect(updateSpy.mock.calls[0][1]).toMatchObject({ suggestedPlayers: null, targets: null });
    });

    it('blocks an invalid suggested players value', async () => {
      const createSpy = vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't-1', businessId: 'TR-0007' });
      render(<TrainingBuilderDialog onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
      fireEvent.change(screen.getByLabelText('Suggested players'), { target: { value: '61' } });
      fireEvent.click(screen.getByText('Save'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Suggested players must be a whole number from 1 to 60.');
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
  describe('picker suggestions', () => {
    const base = {
      id: 't-5',
      businessId: 'TR-0005',
      name: 'Serve day',
      description: '',
      ageGroupTarget: '',
      exercises: [],
      exerciseIds: [],
      createdBy: 'x',
      createdAt: null,
    };
    const big = { id: 'ex-8', name: 'Big game', description: '', category: 'game' as const, minPlayers: 8, createdBy: 'x', createdAt: null };
    const small = { id: 'ex-4', name: 'Small serve', description: '', category: 'service' as const, minPlayers: 4, createdBy: 'x', createdAt: null };
    const filterGroup = () => screen.getByRole('group', { name: 'Filter exercises by category' });

    beforeEach(() => {
      vi.mocked(exercisesApi.listExercisesInCategories).mockResolvedValue({ exercises: [small], lastDoc: null, hasMore: false });
    });

    it('shows a suggested section from the targets, and none without targets', async () => {
      const { unmount } = render(
        <TrainingBuilderDialog training={{ ...base, targets: ['service'] }} onClose={vi.fn()} onSaved={vi.fn()} />
      );
      fireEvent.click(screen.getByText('Add exercise'));
      expect(await within(await screen.findByRole('list', { name: 'Suggested for your targets' })).findByText('Small serve')).toBeInTheDocument();
      expect(exercisesApi.listExercisesInCategories).toHaveBeenCalledWith(['service'], null);
      unmount();

      vi.mocked(exercisesApi.listExercisesInCategories).mockClear();
      render(<TrainingBuilderDialog training={base} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByText('Add exercise'));
      await screen.findByRole('button', { name: 'Add Pepper' });
      expect(screen.queryByRole('list', { name: 'Suggested for your targets' })).not.toBeInTheDocument();
      expect(exercisesApi.listExercisesInCategories).not.toHaveBeenCalled();
    });

    it('hides the suggested section while a category filter is picked', async () => {
      render(<TrainingBuilderDialog training={{ ...base, targets: ['service'] }} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByText('Add exercise'));
      await screen.findByRole('list', { name: 'Suggested for your targets' });
      fireEvent.click(within(filterGroup()).getByRole('button', { name: 'Defense' }));
      await waitFor(() => expect(screen.queryByRole('list', { name: 'Suggested for your targets' })).not.toBeInTheDocument());
      fireEvent.click(within(filterGroup()).getByRole('button', { name: 'All' }));
      expect(await screen.findByRole('list', { name: 'Suggested for your targets' })).toBeInTheDocument();
    });

    it('flags and sinks a drill needing more players than suggested, but keeps it addable', async () => {
      vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [big, exOne, small], lastDoc: null, hasMore: false });
      render(<TrainingBuilderDialog training={{ ...base, suggestedPlayers: 6 }} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByText('Add exercise'));
      await screen.findByRole('button', { name: 'Add Big game' });
      const names = screen.getAllByRole('button', { name: /^Add (?!exercise)/ }).map((b) => b.getAttribute('aria-label'));
      expect(names).toEqual(['Add Pepper', 'Add Small serve', 'Add Big game']);
      expect(screen.getByText('Needs 8 · suggested 6')).toBeInTheDocument();
      expect(screen.getByText('Min 4 players')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Big game' })).toBeEnabled();
    });

    it('flags a selected row that needs more players than suggested', async () => {
      vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [big], lastDoc: null, hasMore: false });
      render(<TrainingBuilderDialog training={{ ...base, suggestedPlayers: 6 }} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByText('Add exercise'));
      fireEvent.click(await screen.findByRole('button', { name: 'Add Big game' }));
      const rows = screen.getByRole('list', { name: 'Training exercises' });
      expect(within(rows).getByText('Needs 8 · suggested 6')).toBeInTheDocument();
    });

    it('marks a target as covered once a selected exercise has that category', async () => {
      vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exTwo], lastDoc: null, hasMore: false });
      render(<TrainingBuilderDialog training={{ ...base, targets: ['service', 'defense'] }} onClose={vi.fn()} onSaved={vi.fn()} />);
      const targets = screen.getByRole('group', { name: 'Training targets' });
      expect(within(targets).queryByRole('button', { name: 'Service (covered)' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByText('Add exercise'));
      fireEvent.click(await screen.findByRole('button', { name: 'Add Serve targets' }));
      expect(within(targets).getByRole('button', { name: 'Service (covered)' })).toBeInTheDocument();
      expect(within(targets).getByRole('button', { name: 'Defense' })).toBeInTheDocument();
    });
      it('offers more suggestions only when the query says there are more', async () => {
      const cursor = { id: 'ex-4' } as never;
      vi.mocked(exercisesApi.listExercisesInCategories).mockResolvedValue({ exercises: [small], lastDoc: cursor, hasMore: false });
      render(<TrainingBuilderDialog training={{ ...base, targets: ['service'] }} onClose={vi.fn()} onSaved={vi.fn()} />);
      fireEvent.click(screen.getByText('Add exercise'));
      await within(await screen.findByRole('list', { name: 'Suggested for your targets' })).findByText('Small serve');
      expect(screen.queryByRole('button', { name: 'Load more suggestions' })).not.toBeInTheDocument();
    });
});
});
