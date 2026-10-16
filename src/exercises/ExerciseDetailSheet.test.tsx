import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as diagramsApi from '../diagrams/diagramsApi';
import type { Diagram } from '../types/diagram';
import { ExerciseDetailSheet, type ExerciseDetailEntry } from './ExerciseDetailSheet';

vi.mock('../diagrams/diagramsApi');
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));

const mk = (id: string, title: string): Diagram => ({
  id,
  title,
  order: 0,
  updatedBy: 'x',
  updatedAt: null,
  scene: { v: 1, court: 'full', showZones: false, items: [] },
});

const entries: ExerciseDetailEntry[] = [
  { exerciseId: 'ex-1', name: 'Pepper', description: 'Two players.', category: 'warmup', durationMinutes: 10 },
  { exerciseId: 'ex-2', name: 'Serve targets', description: 'Aim at zones.', category: 'service', durationMinutes: 15 },
  { exerciseId: 'ex-3', name: null, description: '', durationMinutes: 5 },
];

describe('ExerciseDetailSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(diagramsApi.listDiagrams).mockImplementation(async (id) =>
      id === 'ex-1' ? [mk('d1', 'Setup'), mk('d2', 'Rotation')] : [],
    );
  });

  it('shows the exercise with its timing slot and steps through its diagrams', async () => {
    render(<ExerciseDetailSheet entries={entries} startIndex={0} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Pepper' })).toBeInTheDocument();
    expect(screen.getByText('Exercise 1 of 3')).toBeInTheDocument();
    expect(screen.getByText(/10 min · min 0–10/)).toBeInTheDocument();
    expect(await screen.findByText('Setup')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next diagram' }));
    expect(screen.getByText('Rotation')).toBeInTheDocument();
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('moves between exercises with the footer buttons and arrow keys', async () => {
    render(<ExerciseDetailSheet entries={entries} startIndex={0} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous exercise' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(screen.getByRole('dialog', { name: 'Serve targets' })).toBeInTheDocument();
    expect(screen.getByText(/15 min · min 10–25/)).toBeInTheDocument();
    expect(await screen.findByText('No diagrams for this exercise.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Deleted exercise' })).toBeInTheDocument();
    expect(screen.getByText('This exercise was deleted from the library.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next exercise' })).toBeDisabled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<ExerciseDetailSheet entries={entries} startIndex={1} onClose={onClose} />);
    await screen.findByText('No diagrams for this exercise.');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders an unsaved draft scene without fetching diagrams', () => {
    const scene = { v: 1 as const, court: 'full' as const, showZones: false, items: [] };
    render(
      <ExerciseDetailSheet
        entries={[
          { exerciseId: 'draft-1', name: 'Draft', description: 'D', category: 'game', scene },
          { exerciseId: 'draft-2', name: 'No diagram', description: '', scene: null },
        ]}
        startIndex={0}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('AI draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(screen.getByText('No diagrams for this exercise.')).toBeInTheDocument();
    expect(diagramsApi.listDiagrams).not.toHaveBeenCalled();
  });
});
