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
    appUser: { uid: 'coach-uid', email: 'coach@example.com', role: 'admin' },
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

  it('opens the bulk-import dialog from the Import button', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Import' }));
    expect(screen.getByRole('dialog', { name: /Import trainings/ })).toBeInTheDocument();
  });
});
