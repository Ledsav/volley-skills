import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as exercisesApi from '../exercises/exercisesApi';
import type { Training } from '../types/training';
import { TrainingViewSheet } from './TrainingViewSheet';

vi.mock('../exercises/exercisesApi');
vi.mock('../diagrams/diagramsApi', () => ({ listDiagrams: vi.fn().mockResolvedValue([]) }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('../diagrams/DiagramThumbnail', () => ({ DiagramThumbnail: () => null }));

const training = {
  id: 't-1',
  businessId: 'TR-0007',
  name: 'Passing circuit',
  description: 'Focus on platform angle.',
  ageGroupTarget: 'U17',
  exercises: [
    { exerciseId: 'ex-2', order: 2, durationMinutes: 15 },
    { exerciseId: 'ex-1', order: 1, durationMinutes: 10 },
  ],
} as unknown as Training;

describe('TrainingViewSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exercisesApi.getExercisesByIds).mockResolvedValue([
      { id: 'ex-1', name: 'Pepper', description: 'Two players.', category: 'warmup', createdBy: 'x', createdAt: null },
      { id: 'ex-2', name: 'Serve targets', description: 'Aim at zones.', category: 'service', createdBy: 'x', createdAt: null },
    ]);
  });

  it('lists the plan in order with time slots and totals', async () => {
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'TR-0007 · Passing circuit' })).toBeInTheDocument();
    expect(screen.getByText(/2 exercises · 25 min/)).toBeInTheDocument();
    expect(screen.getByText('Focus on platform angle.')).toBeInTheDocument();

    const plan = await screen.findByRole('list', { name: 'Training plan' });
    const items = within(plan).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Pepper');
    expect(items[0]).toHaveTextContent('10 min · min 0–10');
    expect(items[1]).toHaveTextContent('Serve targets');
    expect(items[1]).toHaveTextContent('15 min · min 10–25');
  });

  it('opens an exercise full-screen from the plan, and Start opens the first one', async () => {
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'View exercise 2: Serve targets' }));
    expect(screen.getByRole('dialog', { name: 'Serve targets' })).toBeInTheDocument();
    expect(await screen.findByText('No diagrams for this exercise.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Serve targets' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('dialog', { name: 'Pepper' })).toBeInTheDocument();
    expect(await screen.findByText('No diagrams for this exercise.')).toBeInTheDocument();
  });

  it('hands off to the editor', async () => {
    const onEdit = vi.fn();
    render(<TrainingViewSheet training={training} onClose={vi.fn()} onEdit={onEdit} />);
    await screen.findByRole('list', { name: 'Training plan' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
