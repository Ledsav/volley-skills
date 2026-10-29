import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act } from '@testing-library/react';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import { WithChrome } from '../test/chromeProbe';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { ExercisesPage } from './ExercisesPage';
import * as exercisesApi from './exercisesApi';

vi.mock('./exercisesApi');
vi.mock('./ExerciseFormDialog', () => ({
  ExerciseFormDialog: ({ onSaved }: { onSaved: () => void }) => (
    <button onClick={onSaved}>form-dialog-stub</button>
  ),
}));
vi.mock('../aiDraft/ExerciseDraftDialog', () => ({
  ExerciseDraftDialog: ({ onSaved }: { onSaved: (n: number) => void }) => (
    <button onClick={() => onSaved(2)}>draft-dialog-stub</button>
  ),
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
const clubOver = vi.hoisted(() => ({ aiEnabled: true }));
vi.mock('../auth/AuthContext', async () => {
  const { authValue, clubAdminAccess, testClub } = await import('../test/authValue');
  return {
    useAuth: () =>
      authValue({
        firebaseUser: { uid: 'coach-uid' } as never,
        appUser: { uid: 'coach-uid', email: 'coach@example.com' },
        access: clubAdminAccess,
        club: testClub({ aiEnabled: clubOver.aiEnabled }),
      }),
  };
});

const exercise = {
  id: 'ex-1',
  name: 'Pepper',
  description: 'Control drill',
  category: 'warmup' as const,
  createdBy: 'x',
  createdAt: null,
};

function renderPage(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries'] = ['/exercises']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NoticeProvider>
        <Routes>
          <Route
            path="/exercises"
            element={
              <WithChrome>
                <ExercisesPage />
              </WithChrome>
            }
          />
          <Route path="/exercises/:exerciseId/diagram" element={<p>diagram-editor-stub</p>} />
        </Routes>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('ExercisesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubOver.aiEnabled = true;
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exercise], lastDoc: null, hasMore: false });
  });

  it('opens the exercise from ?exercise=', async () => {
    vi.mocked(exercisesApi.getExercise).mockResolvedValue(exercise);
    renderPage(['/exercises?exercise=ex-1']);
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
    expect(exercisesApi.getExercise).toHaveBeenCalledWith('ex-1');
  });

  it('shows nothing for an unknown ?exercise= id', async () => {
    vi.mocked(exercisesApi.getExercise).mockResolvedValue(null);
    renderPage(['/exercises?exercise=nope']);
    await screen.findByText('Pepper');
    await waitFor(() => expect(exercisesApi.getExercise).toHaveBeenCalled());
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();
  });

  it('hides Draft with AI when the club has AI off', async () => {
    clubOver.aiEnabled = false;
    renderPage();
    await screen.findByText('Pepper');
    expect(screen.queryByRole('button', { name: 'Draft with AI' })).not.toBeInTheDocument();
  });

  it('opens the exercise form from the main action published to the shell', async () => {
    renderPage();
    await screen.findByText('Pepper');
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('chrome-probe')).getByRole('button', { name: 'New exercise' }));
    expect(screen.getByText('form-dialog-stub')).toBeInTheDocument();
  });

  it('renders exercises from the first page', async () => {
    renderPage();
    const nameEl = await screen.findByText('Pepper');
    expect(nameEl).toBeInTheDocument();
    // The category-filter <select> also contains a "Warm-up" <option>, so scope
    // the badge assertion to the exercise row rather than the whole document.
    // The name is a <span> in a wrapper <div> (the row itself is the clickable
    // element now), so scope to that wrapper instead of a <button> ancestor.
    expect(nameEl.closest('div')).toHaveTextContent('Warm-up');
  });

  it('adapts the page header and gutter for mobile: title stacks above a full-width action row', async () => {
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Exercises' });

    const page = heading.closest('[data-page-header]')?.parentElement as HTMLElement;
    expect(page).toHaveAttribute('data-page-container', 'content');
    expect(page.className).toContain('px-[var(--page-gutter)]');

    const header = heading.closest('[data-page-header]') as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    // the page's actions live in the shell toolbar, not in a content row
    expect(heading.closest('[data-page-header]')?.querySelector('button')).toBeNull();
  });

  it('shows each exercise as a list row that becomes a gallery card from md, with a clamped description', async () => {
    renderPage();
    const entry = (await screen.findByText('Pepper')).closest('[role="button"]') as HTMLElement;
    expect(entry.className).toContain('md:flex-col');
    expect(screen.getByText('Control drill').className).toContain('line-clamp-2');
  });

  async function openMenu() {
    await screen.findByText('Pepper');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Pepper' }));
  }

  it('opens the edit dialog when the row is clicked, but not when the kebab is clicked', async () => {
    renderPage();
    await openMenu();
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByText('Pepper'));
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
  });

  it('opens the edit dialog on keyboard Enter on the row, but not on Enter on the kebab', async () => {
    renderPage();
    await screen.findByText('Pepper');
    const row = screen.getByText('Pepper').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for Pepper' }), { key: 'Enter' });
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
  });

  it('the kebab and its items never open the edit sheet', async () => {
    vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(3);
    renderPage();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await screen.findByRole('alertdialog');
    expect(screen.queryByText('form-dialog-stub')).not.toBeInTheDocument();
  });

  it('right-click offers Edit, Edit diagrams and Delete', async () => {
    renderPage();
    await screen.findByText('Pepper');
    fireEvent.contextMenu(screen.getByText('Pepper').closest('[role="button"]') as HTMLElement, { clientX: 20, clientY: 20 });
    const menu = screen.getByRole('menu', { name: 'Actions for Pepper' });
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Edit diagrams' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('Edit diagrams from the row menu opens the editor', async () => {
    renderPage();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit diagrams' }));
    expect(await screen.findByText('diagram-editor-stub')).toBeInTheDocument();
  });

  it('the category filter is a horizontally scrolling chip row', async () => {
    renderPage();
    await screen.findByText('Pepper');
    expect(screen.getByRole('group', { name: 'Filter by category' })).toHaveClass('overflow-x-auto');
  });

  describe('delete', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(0);
      vi.mocked(exercisesApi.deleteExercise).mockResolvedValue(undefined);
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    async function chooseDelete() {
      await openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    }

    it('an unused exercise delete is an undo: the card leaves at once and the delete runs when the notice expires', async () => {
      renderPage();
      await chooseDelete();
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(exercisesApi.deleteExercise).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(exercisesApi.deleteExercise).toHaveBeenCalledWith('ex-1');
      expect(exercisesApi.listExercises).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Pepper')).not.toBeInTheDocument();
    });

    it('Undo restores the card and never deletes', async () => {
      renderPage();
      await chooseDelete();
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(await screen.findByText('Pepper')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(exercisesApi.deleteExercise).not.toHaveBeenCalled();
    });

    it('a second delete commits the first at once', async () => {
      const other = { ...exercise, id: 'ex-2', name: 'Serve' };
      vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [exercise, other], lastDoc: null, hasMore: false });
      renderPage();
      await screen.findByText('Serve');
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Pepper' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Actions for Serve' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await waitFor(() => expect(exercisesApi.deleteExercise).toHaveBeenCalledWith('ex-1'));
      expect(exercisesApi.deleteExercise).not.toHaveBeenCalledWith('ex-2');
    });

    it('a failed delete brings the card back with the error', async () => {
      vi.mocked(exercisesApi.deleteExercise).mockRejectedValue(new Error('denied'));
      renderPage();
      await chooseDelete();
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(await screen.findByText('Pepper')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Could not delete the exercise. Please try again.');
    });

    it('a used exercise keeps the confirm naming the training count and offers no undo', async () => {
      vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(2);
      renderPage();
      await chooseDelete();
      expect(await screen.findByText(/used in 2 training/i)).toBeInTheDocument();
      expect(screen.getByText('Pepper')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Yes, delete exercise' }));
      await waitFor(() => expect(exercisesApi.deleteExercise).toHaveBeenCalledWith('ex-1'));
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      expect(exercisesApi.listExercises).toHaveBeenCalledTimes(1);
    });

    it('cancelling the confirm after a failed delete clears the stale error (m-6)', async () => {
      vi.mocked(exercisesApi.countTrainingsUsingExercise).mockResolvedValue(2);
      vi.mocked(exercisesApi.deleteExercise).mockRejectedValue(new Error('denied'));
      renderPage();
      await chooseDelete();
      fireEvent.click(await screen.findByRole('button', { name: 'Yes, delete exercise' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete');
      fireEvent.click(screen.getByRole('button', { name: /cancel|keep/i }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('a double Delete before the usage count returns reads it once and shows one notice (m-7)', async () => {
      let resolveCount!: (n: number) => void;
      vi.mocked(exercisesApi.countTrainingsUsingExercise).mockReturnValue(new Promise<number>((r) => { resolveCount = r; }));
      renderPage();
      await chooseDelete();
      await chooseDelete();
      await act(async () => resolveCount(0));
      await waitFor(() => expect(screen.queryByText('Pepper')).not.toBeInTheDocument());
      expect(exercisesApi.countTrainingsUsingExercise).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole('button', { name: 'Undo' })).toHaveLength(1);
    });

    it('still opens the delete confirmation when the usage count read fails', async () => {
      vi.mocked(exercisesApi.countTrainingsUsingExercise).mockRejectedValue(new Error('offline'));
      renderPage();
      await chooseDelete();
      expect(await screen.findByText(/could not be determined/i)).toBeInTheDocument();
    });
  });

  it('reloads with a category filter when a category chip is clicked', async () => {
    renderPage();
    await screen.findByText('Pepper');

    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));

    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, 'attack'));
  });

  it('marks the active category chip and returns to "All" when it is clicked again', async () => {
    renderPage();
    await screen.findByText('Pepper');

    const attackChip = screen.getByRole('button', { name: 'Attack' });
    fireEvent.click(attackChip);
    await waitFor(() => expect(attackChip).toHaveAttribute('aria-pressed', 'true'));

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenLastCalledWith(null, null));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('surfaces an alert and hides the empty state when the first page fails to load', async () => {
    vi.mocked(exercisesApi.listExercises).mockRejectedValueOnce(new Error('permission-denied'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load exercises/i);
    expect(screen.queryByText('No exercises yet.')).not.toBeInTheDocument();
  });

  it('opens the new exercise form from a pending action', async () => {
    renderPage([{ pathname: '/exercises', state: { pendingAction: 'new-exercise' } }]);
    expect(await screen.findByText('form-dialog-stub')).toBeInTheDocument();
  });

  it('opens the bulk-import dialog from the Import button', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import exercises/ })).toBeInTheDocument();
  });

  it('opens AI drafting and reloads the list after saving', async () => {
    renderPage();
    await screen.findByText('Pepper');
    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }));
    fireEvent.click(screen.getByText('draft-dialog-stub'));
    await waitFor(() => expect(exercisesApi.listExercises).toHaveBeenCalledTimes(2));
  });
});
