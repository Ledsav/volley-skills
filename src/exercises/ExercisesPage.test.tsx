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
    // The name is a <span> in a wrapper <div> (the row itself is the clickable
    // element now), so scope to that wrapper instead of a <button> ancestor.
    expect(nameEl.closest('div')).toHaveTextContent('Warm-up');
  });

  it('adapts the page header and gutter for mobile: title stacks above a full-width action row', async () => {
    const { container } = render(<ExercisesPage />);
    const heading = await screen.findByRole('heading', { name: 'Exercises' });

    const page = container.firstChild as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    const header = heading.parentElement as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    const actions = screen.getByRole('button', { name: 'Import' }).parentElement as HTMLElement;
    expect(actions.className).toContain('grid-cols-2');
    expect(actions.className).toContain('sm:flex');
  });

  it('stacks each exercise entry as a card on mobile, with the description un-clamped', async () => {
    render(<ExercisesPage />);
    const entry = (await screen.findByText('Pepper')).closest('[role="button"]') as HTMLElement;
    expect(entry.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(entry.className).toContain('sm:flex-row');
    // each entry carries its own border + shadow on mobile, dropped at >=sm
    expect(entry.className).toMatch(/(^|\s)border(\s|$)/);
    expect(entry.className).toContain('shadow-card');
    expect(entry.className).toContain('sm:border-0');
    // description shows two lines on the phone card instead of a single clamped line
    expect(screen.getByText('Control drill').className).toContain('line-clamp-2');
  });

  it('opens the edit dialog when the row is clicked, but not when Delete is clicked', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByText('Delete'));
    // Delete stops propagation — the row's open-dialog handler must not fire.
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Pepper'));
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
  });

  it('opens the edit dialog on keyboard Enter on the row, but not on Enter on the Delete button', async () => {
    render(<ExercisesPage />);
    await screen.findByText('Pepper');

    const row = screen.getByText('Pepper').closest('[role="button"]') as HTMLElement;

    // Enter bubbling up from the nested Delete button must NOT open the edit dialog.
    fireEvent.keyDown(screen.getByText('Delete'), { key: 'Enter' });
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();

    // Enter on the row element itself DOES open it.
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
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
