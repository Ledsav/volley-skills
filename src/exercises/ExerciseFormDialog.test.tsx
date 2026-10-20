import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import * as exercisesApi from './exercisesApi';
import { useAuth } from '../auth/AuthContext';
import { authValue } from '../test/authValue';

vi.mock('./exercisesApi');
vi.mock('../auth/AuthContext');
vi.mock('../diagrams/diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

describe('ExerciseFormDialog', () => {
  beforeEach(async () => {
    // <DiagramThumbnail>/strip fetch on mount — default to no diagrams unless a test overrides it.
    const diagramsApi = await import('../diagrams/diagramsApi');
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([]);
  });

  it('creates a new exercise from the form fields', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');
    const onSaved = vi.fn();

    render(
      <MemoryRouter>
        <ExerciseFormDialog onClose={vi.fn()} onSaved={onSaved} />
      </MemoryRouter>
    );

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
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null }));
    const updateSpy = vi.spyOn(exercisesApi, 'updateExercise').mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <ExerciseFormDialog
          exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper v2' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith('ex-1', { name: 'Pepper v2', description: '', category: 'warmup' })
    );
  });

  it('blocks submission with an empty name', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-1');

    render(
      <MemoryRouter>
        <ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Save'));

    await screen.findByRole('alert');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shows an Edit diagrams button and a diagram strip in edit mode', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null }));
    const diagramsApi = await import('../diagrams/diagramsApi');
    vi.spyOn(diagramsApi, 'listDiagrams').mockResolvedValue([
      { id: 'd1', title: 'Setup', order: 0, updatedBy: 'x', updatedAt: null, scene: { v: 1, court: 'full', showZones: false, items: [] } },
    ]);

    render(
      <MemoryRouter>
        <ExerciseFormDialog
          exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /edit diagrams/i })).toBeInTheDocument();
    expect(await screen.findByText('Setup')).toBeInTheDocument();
  });

  it('does not show Edit diagrams when creating a new exercise', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'u' } as never }));
    render(<MemoryRouter><ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /edit diagrams/i })).not.toBeInTheDocument();
  });

  it('creates the exercise and navigates to its diagram editor from "Create & add diagrams"', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-42');
    const onSaved = vi.fn();

    function LocationDisplay() {
      return <div data-testid="pathname">{useLocation().pathname}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/exercises']}>
        <Routes>
          <Route path="/exercises" element={<ExerciseFormDialog onClose={vi.fn()} onSaved={onSaved} />} />
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'attack' } });
    fireEvent.click(screen.getByText('Create & add diagrams'));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith(
        { name: 'Pepper', description: '', category: 'attack' },
        'coach-uid'
      )
    );
    await waitFor(() => expect(screen.getByTestId('pathname')).toHaveTextContent('/exercises/ex-42/diagram'));
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('does not show "Create & add diagrams" in edit mode', async () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: null }));
    render(
      <MemoryRouter>
        <ExerciseFormDialog
          exercise={{ id: 'ex-1', name: 'Pepper', description: '', category: 'warmup', createdBy: 'x', createdAt: null }}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    );
    await screen.findByRole('button', { name: /edit diagrams/i });
    expect(screen.queryByText('Create & add diagrams')).not.toBeInTheDocument();
  });

  it('creates the exercise once even when Save is clicked twice', () => {
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockReturnValue(new Promise(() => undefined));
    render(
      <MemoryRouter>
        <ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper' } });
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Create & add diagrams/ })).toBeDisabled();
  });

  it('offline, "Create & add diagrams" explains it needs a connection instead of hanging', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockClear();
    render(
      <MemoryRouter>
        <ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pepper' } });
    fireEvent.click(screen.getByRole('button', { name: /Create & add diagrams/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline/i);
    expect(createSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  describe('minimum players', () => {
    const existing = { id: 'ex-1', name: 'Pepper', description: '', category: 'warmup' as const, createdBy: 'x', createdAt: null };
    const renderForm = (exercise?: typeof existing & { minPlayers?: number }) =>
      render(
        <MemoryRouter>
          <ExerciseFormDialog exercise={exercise} onClose={vi.fn()} onSaved={vi.fn()} />
        </MemoryRouter>
      );

    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue(authValue({ firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never }));
    });

    it('saves a new exercise with its minimum players', async () => {
      const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-9');
      renderForm();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Six-pack' } });
      fireEvent.change(screen.getByLabelText('Minimum players'), { target: { value: '6' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() =>
        expect(createSpy).toHaveBeenCalledWith(
          { name: 'Six-pack', description: '', category: 'warmup', minPlayers: 6 },
          'coach-uid'
        )
      );
    });

    it('clears minimum players on an exercise that had one', async () => {
      const updateSpy = vi.spyOn(exercisesApi, 'updateExercise').mockResolvedValue(undefined);
      renderForm({ ...existing, minPlayers: 6 });
      expect(screen.getByLabelText('Minimum players')).toHaveValue('6');
      fireEvent.change(screen.getByLabelText('Minimum players'), { target: { value: '' } });
      fireEvent.click(screen.getByText('Save'));
      await waitFor(() =>
        expect(updateSpy).toHaveBeenCalledWith('ex-1', { name: 'Pepper', description: '', category: 'warmup', minPlayers: null })
      );
    });

    it('blocks an unparseable minimum players on "Create & add diagrams" too', async () => {
      const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-9');
      renderForm();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
      fireEvent.change(screen.getByLabelText('Minimum players'), { target: { value: '7,5' } });
      fireEvent.click(screen.getByText('Create & add diagrams'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Minimum players must be a whole number from 1 to 30.');
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('blocks an invalid minimum players with an inline error', async () => {
      const createSpy = vi.spyOn(exercisesApi, 'createExercise').mockResolvedValue('ex-9');
      renderForm();
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'X' } });
      fireEvent.change(screen.getByLabelText('Minimum players'), { target: { value: '0' } });
      fireEvent.click(screen.getByText('Save'));
      expect(await screen.findByRole('alert')).toHaveTextContent('Minimum players must be a whole number from 1 to 30.');
      expect(createSpy).not.toHaveBeenCalled();
    });
  });
});
