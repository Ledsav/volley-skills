import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrainingsPage } from './TrainingsPage';
import * as trainingsApi from './trainingsApi';

vi.mock('./trainingsApi');
vi.mock('./TrainingBuilderDialog', () => ({
  TrainingBuilderDialog: ({ onSaved }: { onSaved: () => void }) => <button onClick={onSaved}>builder-stub</button>,
}));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    firebaseUser: { uid: 'coach-uid' },
    appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'superadmin' },
  }),
}));

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
      <Routes>
        <Route path="/trainings" element={<TrainingsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TrainingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trainingsApi.listTrainings).mockResolvedValue({ trainings: [training], lastDoc: null, hasMore: false });
    vi.mocked(trainingsApi.findTrainingByBusinessId).mockResolvedValue(training);
  });

  it('lists trainings from the paginated query by default', async () => {
    renderPage();
    expect(await screen.findByText('Passing circuit')).toBeInTheDocument();
    expect(screen.getByText('TR-0007')).toBeInTheDocument();
  });

  it('adapts the page header, gutter, and filter row for mobile', async () => {
    const { container } = renderPage();
    const heading = await screen.findByRole('heading', { name: 'Trainings' });

    const page = container.firstChild as HTMLElement;
    expect(page.className).toContain('p-4');
    expect(page.className).toContain('sm:p-6');

    const header = heading.parentElement as HTMLElement;
    expect(header.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(header.className).toContain('sm:flex-row');

    const actions = screen.getByRole('button', { name: 'Import' }).parentElement as HTMLElement;
    expect(actions.className).toContain('grid-cols-2');
    expect(actions.className).toContain('sm:flex');

    // filters wrap instead of overflowing a phone screen; fields are full-width there
    const ageField = screen.getByLabelText('Age group');
    expect(ageField.className).toContain('w-full');
    expect(ageField.className).toContain('sm:w-40');
    const filterRow = ageField.closest('div')?.parentElement as HTMLElement;
    expect(filterRow.className).toContain('flex-wrap');
  });

  it('stacks each training entry as a card on mobile, with Delete on its own row', async () => {
    renderPage();
    const entry = (await screen.findByText('Passing circuit')).closest('[role="button"]') as HTMLElement;
    expect(entry.className).toMatch(/(^|\s)flex-col(\s|$)/);
    expect(entry.className).toContain('sm:flex-row');
    // each entry carries its own border + shadow on mobile, dropped at >=sm
    expect(entry.className).toMatch(/(^|\s)border(\s|$)/);
    expect(entry.className).toContain('shadow-card');
    expect(entry.className).toContain('sm:border-0');
  });

  it('switches to the single business-id lookup when that field is filled', async () => {
    renderPage();
    await screen.findByText('Passing circuit');

    fireEvent.change(screen.getByLabelText('Business ID'), { target: { value: 'TR-0007' } });

    await waitFor(() => expect(trainingsApi.findTrainingByBusinessId).toHaveBeenCalledWith('TR-0007'));
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

  it('confirms before deleting a training', async () => {
    vi.mocked(trainingsApi.deleteTraining).mockResolvedValue(undefined);
    renderPage();
    await screen.findByText('Passing circuit');

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Yes, delete training'));

    await waitFor(() => expect(trainingsApi.deleteTraining).toHaveBeenCalledWith('t-1'));
  });

  it('opens the builder when the row is clicked, but not when Delete is clicked', async () => {
    renderPage();
    await screen.findByText('Passing circuit');

    // Delete stops propagation — the row's open-builder handler must not fire.
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.queryByText('builder-stub')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));

    fireEvent.click(screen.getByText('Passing circuit').closest('[role="button"]') as HTMLElement);
    expect(await screen.findByText('builder-stub')).toBeInTheDocument();
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

    const field = screen.getByLabelText('Age group');
    fireEvent.change(field, { target: { value: 'U' } });
    fireEvent.change(field, { target: { value: 'U1' } });
    fireEvent.change(field, { target: { value: 'U17' } });

    expect(trainingsApi.listTrainings).not.toHaveBeenCalled();

    await waitFor(() => expect(trainingsApi.listTrainings).toHaveBeenCalledTimes(1));
    expect(trainingsApi.listTrainings).toHaveBeenCalledWith(null, { ageGroupTarget: 'U17' });
  });
});
