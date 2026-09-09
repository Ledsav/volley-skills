import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DiagramLightbox } from './DiagramLightbox';
import type { Diagram } from '../types/diagram';

const mk = (id: string, title: string): Diagram => ({
  id, title, order: 0, updatedBy: 'x', updatedAt: null,
  scene: { v: 1, court: 'full', showZones: false, items: [] },
});

const diagrams = [mk('d1', 'Setup'), mk('d2', 'Phase 1')];

it('shows the start diagram and steps forward with wrap', () => {
  render(<DiagramLightbox diagrams={diagrams} startIndex={0} onClose={vi.fn()} />);
  expect(screen.getByText('Setup')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Phase 1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText('Setup')).toBeInTheDocument();
});

it('closes on the close button and on Escape', () => {
  const onClose = vi.fn();
  render(<DiagramLightbox diagrams={diagrams} startIndex={0} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

it('closes on a click on the backdrop but not on the title text', () => {
  const onClose = vi.fn();
  render(<DiagramLightbox diagrams={diagrams} startIndex={0} onClose={onClose} />);

  fireEvent.click(screen.getByText('Setup'));
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('dialog'));
  expect(onClose).toHaveBeenCalledTimes(1);
});
