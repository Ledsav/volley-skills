import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiError } from '../ai/aiClient';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import { ExerciseDraftDialog } from './ExerciseDraftDialog';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../auth/AuthContext', async () => {
  const { authValue, superAdminAccess } = await import('../test/authValue');
  return { useAuth: () => authValue({ firebaseUser: { uid: 'coach' } as never, access: superAdminAccess }) };
});

const proposal = (name: string) => ({
  name,
  category: 'reception',
  description: `How ${name} runs`,
  diagram: { court: 'full', items: [{ type: 'player', x: 30, y: 80, label: 'P' }] },
});

function renderDialog(ask = vi.fn().mockResolvedValue({ exercises: [proposal('Alpha'), proposal('Beta')] }), onSaved = vi.fn()) {
  render(
    <MemoryRouter>
      <ExerciseDraftDialog onClose={() => {}} onSaved={onSaved} ask={ask} />
    </MemoryRouter>,
  );
  return { ask, onSaved };
}

async function generate(count = '2') {
  fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'serve receive for U15' } });
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: count } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await screen.findByText('Alpha');
}

describe('ExerciseDraftDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: [], lastDoc: null, hasMore: false });
    let n = 0;
    vi.mocked(exercisesApi.createExercise).mockImplementation(async () => `id-${++n}`);
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
  });

  it('previews each proposal with its diagram, then saves only the kept ones', async () => {
    const { ask, onSaved } = renderDialog();
    await generate();
    expect(ask.mock.calls[0][0][1].content).toContain('serve receive for U15');
    expect(screen.getByRole('button', { name: 'Diagram for Alpha' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Keep Beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Save 1 kept' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(1));
    expect(exercisesApi.createExercise).toHaveBeenCalledTimes(1);
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' }), 'coach');
  });

  it('lets the coach edit a proposal before saving', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpha renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save 2 kept' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(2));
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha renamed' }), 'coach');
  });

  it('blocks saving while a kept proposal has no category', async () => {
    renderDialog(vi.fn().mockResolvedValue({ exercises: [{ ...proposal('Alpha'), category: 'blocking' }] }));
    await generate('1');
    expect(screen.getByText('Pick a category.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save 1 kept' })).toBeDisabled();
  });

  it('shows "No diagram" when the diagram could not be used', async () => {
    renderDialog(vi.fn().mockResolvedValue({ exercises: [{ ...proposal('Alpha'), diagram: { court: 'full', items: [{ type: 'arrow' }] } }] }));
    await generate('1');
    expect(screen.getByText('No diagram')).toBeInTheDocument();
  });

  it('Regenerate keeps kept proposals and asks only for the rest', async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce({ exercises: [proposal('Alpha'), proposal('Beta')] })
      .mockResolvedValueOnce({ exercises: [proposal('Gamma')] });
    renderDialog(ask);
    await generate();
    fireEvent.click(screen.getByLabelText('Keep Beta'));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    await screen.findByText('Gamma');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).toBeNull();
    expect(ask.mock.calls[1][0][1].content).toContain('Count: 1');
    expect(ask.mock.calls[1][0][1].content).toContain('Alpha');
  });

  it('shows a Settings link when AI is not configured', async () => {
    renderDialog(vi.fn().mockRejectedValue(new AiError('notConfigured', 'x')));
    fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Set up an AI provider in Settings first.');
    expect(screen.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', '/settings');
  });

  it('aborts the request when the dialog unmounts', async () => {
    let signal: AbortSignal | undefined;
    const ask = vi.fn((_m: unknown, s: AbortSignal) => {
      signal = s;
      return new Promise(() => {});
    });
    const { unmount } = render(
      <MemoryRouter>
        <ExerciseDraftDialog onClose={() => {}} onSaved={() => {}} ask={ask} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('What do you need?'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    await waitFor(() => expect(ask).toHaveBeenCalled());
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
