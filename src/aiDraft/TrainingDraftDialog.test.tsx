import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import * as diagramsApi from '../diagrams/diagramsApi';
import * as trainingsApi from '../trainings/trainingsApi';
import { TrainingDraftDialog } from './TrainingDraftDialog';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi');
vi.mock('../trainings/trainingsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
const access = vi.hoisted(() => ({ exercises: true }));
vi.mock('../auth/AuthContext', async () => {
  const { authValue } = await import('../test/authValue');
  return {
    useAuth: () =>
      authValue({
        firebaseUser: { uid: 'coach' } as never,
        access: { isSuperAdmin: false, sections: { exercises: access.exercises, trainings: true, guides: false } },
      }),
  };
});

const lib = [
  { id: 'ex-1', name: 'Pepper', description: 'Pairs', category: 'warmup' as const, createdBy: 'uid-secret', createdAt: null },
  { id: 'ex-2', name: 'Queen of the court', description: 'Game', category: 'game' as const, createdBy: 'uid-secret', createdAt: null },
];
const reply = {
  name: 'Receive day',
  description: 'Passing focus',
  steps: [
    { exerciseId: 'ex-1', minutes: 15 },
    {
      new: { name: 'Short serve receive', category: 'reception', description: 'x', diagram: { court: 'half', items: [{ type: 'cone', x: 20, y: 30 }] } },
      minutes: 30,
    },
    { exerciseId: 'ex-2', minutes: 20 },
  ],
};

function renderDialog(ask = vi.fn().mockResolvedValue(reply)) {
  const onSaved = vi.fn();
  const onOpenInBuilder = vi.fn();
  render(
    <MemoryRouter>
      <TrainingDraftDialog onClose={() => {}} onSaved={onSaved} onOpenInBuilder={onOpenInBuilder} ask={ask} />
    </MemoryRouter>,
  );
  return { ask, onSaved, onOpenInBuilder };
}

async function generate() {
  fireEvent.change(screen.getByLabelText('Goal'), { target: { value: 'serve receive' } });
  fireEvent.change(screen.getByLabelText('Age group'), { target: { value: 'U15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await screen.findByDisplayValue('Receive day');
}

const steps = () => within(screen.getByRole('list', { name: 'Steps' })).getAllByRole('listitem');

describe('TrainingDraftDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.exercises = true;
    vi.mocked(exercisesApi.listExercises).mockResolvedValue({ exercises: lib, lastDoc: null, hasMore: false });
    vi.mocked(exercisesApi.createExercise).mockResolvedValue('new-1');
    vi.mocked(diagramsApi.saveDiagramSet).mockResolvedValue({ idMap: {} });
    vi.mocked(diagramsApi.getFirstDiagram).mockResolvedValue(null);
    vi.mocked(diagramsApi.listDiagrams).mockResolvedValue([]);
    vi.mocked(trainingsApi.createTraining).mockResolvedValue({ id: 't1', businessId: 'TR-0007' });
  });

  it('sends the library index without uids and lists steps with Library/New badges', async () => {
    const { ask } = renderDialog();
    await generate();
    const system = ask.mock.calls[0][0][0].content as string;
    expect(system).toContain('ex-1 | Pepper | warmup');
    expect(system).not.toContain('uid-secret');
    expect(steps()).toHaveLength(3);
    expect(within(steps()[0]).getByText('Library')).toBeInTheDocument();
    expect(within(steps()[1]).getByText('New')).toBeInTheDocument();
    expect(screen.getByText('65 / 90 min')).toBeInTheDocument();
  });

  it('reorders, edits minutes and removes steps before saving', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Move Queen of the court up' }));
    fireEvent.change(screen.getByLabelText('Minutes for Pepper'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Short serve receive' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('TR-0007'));
    expect(exercisesApi.createExercise).not.toHaveBeenCalled();
    expect(vi.mocked(trainingsApi.createTraining).mock.calls[0][0].exercises).toEqual([
      { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
      { exerciseId: 'ex-2', order: 2, durationMinutes: 20 },
    ]);
  });

  it('saves new exercises then the training', async () => {
    const { onSaved } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(exercisesApi.createExercise).toHaveBeenCalledWith(expect.objectContaining({ name: 'Short serve receive' }), 'coach');
    expect(vi.mocked(trainingsApi.createTraining).mock.calls[0][0].exercises[1].exerciseId).toBe('new-1');
  });

  it('Open in builder saves the new exercises first and hands over real ids', async () => {
    const { onOpenInBuilder } = renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'Open in builder' }));
    await waitFor(() => expect(onOpenInBuilder).toHaveBeenCalled());
    expect(onOpenInBuilder.mock.calls[0][0].exercises.map((e: { exerciseId: string }) => e.exerciseId)).toEqual(['ex-1', 'new-1', 'ex-2']);
    expect(trainingsApi.createTraining).not.toHaveBeenCalled();
  });

  it('hides "Allow new exercises" for coaches who cannot edit exercises', async () => {
    access.exercises = false;
    const { ask } = renderDialog();
    expect(screen.queryByLabelText('Allow new exercises')).toBeNull();
    await generate();
    expect(ask.mock.calls[0][0][0].content).not.toContain('"new"');
    expect(steps()).toHaveLength(2);
  });

  it('lets the coach type the total minutes digit by digit', async () => {
    const { ask } = renderDialog();
    const total = screen.getByLabelText('Total minutes');
    fireEvent.change(total, { target: { value: '1' } });
    expect(total).toHaveValue(1);
    fireEvent.change(total, { target: { value: '12' } });
    fireEvent.change(total, { target: { value: '120' } });
    fireEvent.blur(total);
    expect(total).toHaveValue(120);
    await generate();
    expect(ask.mock.calls[0][0][1].content).toContain('Total minutes: 120');
  });

  it('lets the coach clear and retype a step’s minutes', async () => {
    const { onSaved } = renderDialog();
    await generate();
    const pepper = screen.getByLabelText('Minutes for Pepper');
    fireEvent.change(pepper, { target: { value: '' } });
    expect(pepper).toHaveValue(null);
    fireEvent.change(pepper, { target: { value: '5' } });
    expect(pepper).toHaveValue(5);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(vi.mocked(trainingsApi.createTraining).mock.calls[0][0].exercises[0].durationMinutes).toBe(5);
  });

  it('restores the last valid value when the coach leaves a minutes field empty', async () => {
    renderDialog();
    await generate();
    const pepper = screen.getByLabelText('Minutes for Pepper');
    fireEvent.change(pepper, { target: { value: '' } });
    fireEvent.blur(pepper);
    expect(pepper).toHaveValue(15);
  });

  it('opens a step in the detail sheet, showing the draft diagram', async () => {
    renderDialog();
    await generate();
    fireEvent.click(screen.getByRole('button', { name: 'View Short serve receive' }));
    expect(await screen.findByText('AI draft')).toBeInTheDocument();
  });
});
