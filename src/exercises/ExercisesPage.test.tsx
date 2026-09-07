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
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exercise], lastDoc: null });
  });

  it('renders exercises from the first page', async () => {
    render(<ExercisesPage />);
    const nameEl = await screen.findByText('Pepper');
    expect(nameEl).toBeInTheDocument();
    // The category-filter <select> also contains a "Warm-up" <option>, so scope
    // the badge assertion to the exercise row rather than the whole document.
    expect(nameEl.closest('button')).toHaveTextContent('Warm-up');
  });

  it('reloads with a category filter when the dropdown changes', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'attack' } });

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'attack'));
  });

  it('shows the training usage count in the delete confirmation', async () => {
    vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(2);
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByText('Delete'));

    expect(await screen.findByText(/used in 2 training\(s\)/i)).toBeInTheDocument();
  });
});
