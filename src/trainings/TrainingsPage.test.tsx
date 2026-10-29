import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { WithChrome } from '../test/chromeProbe';
import { NoticeProvider, UNDO_MS } from '../components/Notice';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingsPage } from './TrainingsPage';
import * as trainingsApi from './trainingsApi';

vi.mock('./trainingsApi');
vi.mock('./TrainingBuilderDialog', () => ({
  TrainingBuilderDialog: ({ onSaved, onClose, initial }: { onSaved: () => void; onClose: () => void; initial?: { name: string } }) => (
    <>
      <button onClick={onSaved}>builder-stub{initial ? `:${initial.name}` : ''}</button>
      <button onClick={onClose}>builder-close</button>
    </>
  ),
}));
vi.mock('../aiDraft/TrainingDraftDialog', () => ({
  TrainingDraftDialog: ({ onOpenInBuilder }: { onOpenInBuilder: (i: unknown) => void }) => (
    <button onClick={() => onOpenInBuilder({ name: 'From AI', description: '', ageGroupTarget: '', exercises: [] })}>
      draft-dialog-stub
    </button>
  ),
}));
vi.mock('./TrainingViewSheet', () => ({
  TrainingViewSheet: ({
    onEdit,
    teamContext,
    autoBuildPdf,
  }: {
    onEdit: () => void;
    teamContext?: { teamId: string; date: string; notes: string };
    autoBuildPdf?: boolean;
  }) => (
    <button data-auto={String(!!autoBuildPdf)} onClick={onEdit}>
      view-stub{teamContext ? `:${teamContext.teamId}:${teamContext.date}:${teamContext.notes}` : ''}
    </button>
  ),
}));
vi.mock('../calendar/calendarApi', () => ({
  getCalendarSession: vi.fn().mockResolvedValue({ id: 's-1', date: '2026-10-24', notes: 'Gym B', trainingId: 't-1' }),
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

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: '',
  ageGroupTarget: 'U17',
  exercises: [{ exerciseId: 'ex-1', order: 1, durationMinutes: 10 }],
  exerciseIds: ['ex-1'],
  createdBy: 'x',
  createdAt: null,
};

function renderPage(initialEntry = '/trainings') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NoticeProvider>
        <Routes>
          <Route path="/trainings" element={<WithChrome><TrainingsPage /></WithChrome>} />
        </Routes>
      </NoticeProvider>
    </MemoryRouter>
  );
}

describe('TrainingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clubOver.aiEnabled = true;
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null, hasMore: false });
    vi.mocked(trainingsApi.findTrainingByBusinessId).mockResolvedValue(training);
  });

  afterEach(() => vi.useRealTimers());

  // The free-text filters are debounced; tests that type into them switch to
  // fake timers after the first load and flush the debounce, so they stay fast
  // and don't depend on the debounce delay.
  const flushDebounce = () => act(() => vi.runOnlyPendingTimersAsync());

  it('opens the training from ?training=', async () => {
    vi.mocked(trainingsApi.getTraining).mockResolvedValue(training);
    renderPage('/trainings?training=t-1');
    expect(await screen.findByText('view-stub')).toBeInTheDocument();
    expect(trainingsApi.getTraining).toHaveBeenCalledWith('t-1');
  });

  it('lists trainings from the paginated query by default', async () => {
    renderPage();
    expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
    expect(screen.getByText('TR-0007')).toBeInTheDocument();
  });

  it('adapts the page header, gutter, and filter row for mobile', async () => {
    renderPage();
    const heading = await screen.findByRole('heading', { name: 'Trainings' });

    const page = heading.closest('[data-page-header]')?.parentElement as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    const header = heading.closest('[data-page-header]') as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    // the page's actions live in the shell toolbar, not in a content row
    expect(heading.closest('[data-page-header]')?.querySelector('button')).toBeNull();

    // filters wrap instead of overflowing a phone screen; fields are full-width there
    const ageField = screen.getByLabelText('Age group');
    expect(ageField.className).toContain('w-full');
    expect(ageField.className).toContain('sm:w-40');
    const filterRow = ageField.closest('div')?.parentElement as HTMLElement;
    expect(filterRow.className).toContain('flex-wrap');
  });

  it('lists trainings in a grouped list', async () => {
    renderPage();
    const entry = (await screen.findByText('Passing circuit')).closest('[role="button"]') as HTMLElement;
    const list = entry.closest('ul') as HTMLElement;
    expect(list).toHaveClass('rounded-lg', 'bg-surface');
  });

  it('switches to the single business-id lookup when that field is filled', async () => {
    renderPage();
    await screen.findByText('Passing circuit');
    vi.useFakeTimers();

    fireEvent.change(screen.getByLabelText('Business ID'), { target: { value: 'TR-0007' } });
    await flushDebounce();

    expect(trainingsApi.findTrainingByBusinessId).toHaveBeenCalledWith('TR-0007');
  });

  it('seeds the business-id filter from the ?businessId= query param', async () => {
    renderPage('/trainings?businessId=TR-0007');

    await waitFor(() => expect(trainingsApi.findTrainingByBusinessId).toHaveBeenCalledWith('TR-0007'));
    expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
    expect((screen.getByLabelText('Business ID') as HTMLInputElement).value).toBe('TR-0007');
  });

  it('surfaces an alert and hides the empty state when the list query fails', async () => {
    vi.mocked(trainingsApi.listTrainings).mockRejectedValueOnce(new Error('permission-denied'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load trainings/i);
    expect(screen.queryByText('No trainings found.')).not.toBeInTheDocument();
  });

  async function openMenu() {
    await screen.findByText('Passing circuit');
    fireEvent.click(screen.getByRole('button', { name: 'Actions for TR-0007' }));
  }

  it('the kebab and its items never open the plan', async () => {
    renderPage();
    await openMenu();
    expect(screen.queryByText('view-stub')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for TR-0007' }), { key: 'Enter' });
    expect(screen.queryByText('view-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByText('view-stub')).not.toBeInTheDocument();
  });

  it('opens the read-only plan when the row is clicked (not on the kebab), and the builder from its Edit', async () => {
    renderPage();
    await openMenu();
    expect(screen.queryByText('builder-stub')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('view-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Passing circuit').closest('[role="button"]') as HTMLElement);
    fireEvent.click(await screen.findByText('view-stub'));
    expect(await screen.findByText('builder-stub')).toBeInTheDocument();
  });

  it('right-click offers Open, Edit, Export PDF and Delete', async () => {
    renderPage();
    await screen.findByText('Passing circuit');
    fireEvent.contextMenu(screen.getByText('Passing circuit').closest('[role="button"]') as HTMLElement, { clientX: 20, clientY: 20 });
    const menu = screen.getByRole('menu', { name: 'Actions for TR-0007' });
    for (const name of ['Open', 'Edit', 'Export PDF', 'Delete']) {
      expect(within(menu).getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('Edit from the row menu opens the builder; closing it returns to the list', async () => {
    renderPage();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(await screen.findByText('builder-stub')).toBeInTheDocument();
    fireEvent.click(screen.getByText('builder-close'));
    expect(screen.queryByText('builder-stub')).not.toBeInTheDocument();
    expect(screen.queryByText('view-stub')).not.toBeInTheDocument();
    expect(screen.getByText('Passing circuit')).toBeInTheDocument();
  });

  it('Export PDF from the row menu opens the plan and starts building', async () => {
    renderPage();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export PDF' }));
    expect(await screen.findByText('view-stub')).toHaveAttribute('data-auto', 'true');
  });

  describe('delete', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(trainingsApi.deleteTraining).mockResolvedValue(undefined);
    });

    async function chooseDelete() {
      await openMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    }

    it('delete is an undo: the row leaves at once and the delete runs when the notice expires', async () => {
      renderPage();
      await chooseDelete();
      expect(screen.queryByText('Passing circuit')).not.toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(trainingsApi.deleteTraining).not.toHaveBeenCalled();
      expect(screen.getByText('Training TR-0007 deleted')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(trainingsApi.deleteTraining).toHaveBeenCalledWith('t-1');
      expect(trainingsApi.listTrainings).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('Passing circuit')).not.toBeInTheDocument();
    });

    it('Undo restores the row and never deletes', async () => {
      renderPage();
      await chooseDelete();
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(trainingsApi.deleteTraining).not.toHaveBeenCalled();
    });

    it('a second delete commits the first at once', async () => {
      const other = { ...training, id: 't-2', businessId: 'TR-0008', name: 'Serve circuit' };
      vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training, other], lastDoc: null, hasMore: false });
      renderPage();
      await screen.findByText('Serve circuit');
      fireEvent.click(screen.getByRole('button', { name: 'Actions for TR-0007' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(trainingsApi.deleteTraining).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Actions for TR-0008' }));
      fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await waitFor(() => expect(trainingsApi.deleteTraining).toHaveBeenCalledWith('t-1'));
      expect(trainingsApi.deleteTraining).not.toHaveBeenCalledWith('t-2');
    });

    it('a failed delete brings the row back with the error', async () => {
      vi.mocked(trainingsApi.deleteTraining).mockRejectedValue(new Error('denied'));
      renderPage();
      await chooseDelete();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(UNDO_MS + 50);
      });
      expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Could not delete the training. Please try again.');
    });
  });

  it('opens the bulk-import dialog from the Import button', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import trainings/ })).toBeInTheDocument();
  });

  it('debounces the age-group filter so typing does not query on every keystroke', async () => {
    renderPage();
    await screen.findByText('Passing circuit');
    vi.mocked(trainingsApi.listTrainings).mockClear();
    vi.useFakeTimers();

    const field = screen.getByLabelText('Age group');
    fireEvent.change(field, { target: { value: 'U' } });
    fireEvent.change(field, { target: { value: 'U1' } });
    fireEvent.change(field, { target: { value: 'U17' } });

    expect(trainingsApi.listTrainings).not.toHaveBeenCalled();

    await flushDebounce();
    expect(trainingsApi.listTrainings).toHaveBeenCalledTimes(1);
    expect(trainingsApi.listTrainings).toHaveBeenCalledWith(null, { ageGroupTarget: 'U17' });
  });

  it('more menu holds import and AI draft', async () => {
    renderPage();
    await screen.findByText('Passing circuit');
    expect(screen.getByRole('button', { name: 'New training' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Draft with AI' })).toBeInTheDocument();
  });

  it('more menu holds only import when AI is off', async () => {
    clubOver.aiEnabled = false;
    renderPage();
    await screen.findByText('Passing circuit');
    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft with AI' })).not.toBeInTheDocument();
  });

  it('opens the builder from a pending action', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/trainings', state: { pendingAction: 'new-training' } }]}>
        <Routes>
          <Route path="/trainings" element={<WithChrome><TrainingsPage /></WithChrome>} />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('builder-stub')).toBeInTheDocument();
  });

  it('hides Draft with AI when the club has AI off', async () => {
    clubOver.aiEnabled = false;
    renderPage();
    await screen.findByText('Passing circuit');
    expect(screen.queryByRole('button', { name: 'Draft with AI' })).not.toBeInTheDocument();
  });

  it('opens the builder prefilled from an AI draft', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Draft with AI' }));
    fireEvent.click(screen.getByText('draft-dialog-stub'));
    expect(await screen.findByText('builder-stub:From AI')).toBeInTheDocument();
  });

  it('opens the training for a calendar session with its team context', async () => {
    vi.mocked(trainingsApi.findTrainingByBusinessId).mockResolvedValue(training);
    renderPage('/trainings?businessId=TR-0007&team=u17&session=s-1');
    expect(await screen.findByText('view-stub:u17:2026-10-24:Gym B')).toBeInTheDocument();
  });
});
