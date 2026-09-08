import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExercisesPage } from './ExercisesPage';
import * as exercisesApi from './exercisesApi';

vi.mock('./exercisesApi');
vi.mock('./ExerciseFormDialog', () => ({
  ExerciseFormDialog: ({ onSaved }: { onSaved: () => void }) => (
    <button onClick={onSaved}>form-dialog-stub</button>
  ),
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'coach-uid' },
    appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
  }),
}));

const exercise = {
  id: 'ex-1',
  name: 'Pepper',
  description: 'Control drill',
  category: 'warmup' as const,
  createdBy: 'x',
  createdAt: null,
};

describe('ExercisesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exercise], lastDoc: null, hasMore: false });
  });

  it('renders exercises from the first page', async () => {
    render(<ExercisesPage />);
    const nameEl = await screen.findByText('Pepper');
    expect(nameEl).toBeInTheDocument();
    // The category-filter <select> also contains a "Warm-up" <option>, so scope
    // the badge assertion to the exercise row rather than the whole document.
    expect(nameEl.closest('button')).toHaveTextContent('Warm-up');
  });

  it('reloads with a category filter when a category chip is clicked', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'attack'));
  });

  it('marks the active category chip and returns to "All" when it is clicked again', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    const attackChip = screen.getByRole('button', { name: 'Attack' });
    fireEvent.click(attackChip);
    await waitFor(() => expect(attackChip).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, null));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the training usage count in the delete confirmation', async () => {
    vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(2);
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByText('Delete'));

    expect(await screen.findByText(/used in 2 training\(s\)/i)).toBeInTheDocument();
  });

  it('surfaces an alert and hides the empty state when the first page fails to load', async () => {
    vi.mocked(exercisesApi.listExercises).mockRejectedValueOnce(new Error('permission-denied'));
    render(<ExercisesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load exercises/i);
    expect(screen.queryByText('No exercises yet.')).not.toBeInTheDocument();
  });

  it('still opens the delete confirmation when the usage count read fails', async () => {
    vi.mocked(exercisesApi.countTrainingsUsingExercise).mockRejectedValue(new Error('offline'));
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByText('Delete'));

    expect(await screen.findByText(/could not be determined/i)).toBeInTheDocument();
  });

  it('opens the bulk-import dialog from the Import button', async () => {
    render(<ExercisesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import exercises/ })).toBeInTheDocument();
  });
});
