import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import * as exercisesApi from './exercisesApi';
import { useAuth } from '../auth/AuthContext';

vi.mock('./exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('ExerciseFormDialog', () => {
  it('creates a new exercise from the form fields', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');
    const onSaved = vi.fn();

    render(<ExerciseFormDialog onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'attack' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Control drill' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createSpy).toHaveBeenCalledWith(
      { name: 'Pepper', description: 'Control drill', category: 'attack' },
      'coach-uid'
    );
  });

  it('updates an existing exercise without needing an auth uid', async () => {
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
    const updateSpy = vi.spyOn(exercisesApi, 'updateExercise').mockResolvedValue(undefined);

    render(
      <ExerciseFormDialog
        exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper v2' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('ex-1', { name: 'Pepper v2', description: '', category: 'warmup' })
    );
  });

  it('blocks submission with an empty name', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');

    render(<ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByText('Save'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });
});
