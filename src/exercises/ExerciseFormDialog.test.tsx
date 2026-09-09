import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExerciseFormDialog } from './ExerciseFormDialog';
import * as exercisesApi from './exercisesApi';
import { useAuth } from '../auth/AuthContext';

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
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid', email: 'coach@example.com' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
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
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
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
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
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
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
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
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: { uid: 'u' } as never, appUser: null, loading: false, authError: null });
    render(<MemoryRouter><ExerciseFormDialog onClose={vi.fn()} onSaved={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /edit diagrams/i })).not.toBeInTheDocument();
  });

  it('creates the exercise and navigates to its diagram editor from "Create & add diagrams"', async () => {
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'coach-uid' } as never,
      appUser: null,
      loading: false,
      authError: null,
    });
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
    vi.mocked(useAuth).mockReturnValue({ firebaseUser: null, appUser: null, loading: false, authError: null });
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
});
