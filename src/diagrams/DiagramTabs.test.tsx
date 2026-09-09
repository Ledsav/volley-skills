import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramTabs } from './DiagramTabs';
import { emptyScene } from './sceneFactory';
import type { EditorDiagram } from './useDiagramEditor';

const diagrams: EditorDiagram[] = [
  { id: 'd1', persisted: true, title: 'Setup', order: 0, scene: emptyScene() },
  { id: 'd2', persisted: true, title: 'Phase 1', order: 1, scene: emptyScene() },
];

describe('DiagramTabs', () => {
  it('selects a diagram on chip click', () => {
    const dispatch = vi.fn();
    render(
      <DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />,
    );
    fireEvent.click(screen.getByText('Phase 1'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'selectDiagram', id: 'd2' });
  });

  it('renames the active diagram from the inline input', () => {
    const dispatch = vi.fn();
    render(
      <DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />,
    );
    fireEvent.change(screen.getByDisplayValue('Setup'), { target: { value: 'Warmup' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'renameDiagram', id: 'd1', title: 'Warmup' });
  });

  it('adds a diagram, and the + control is disabled when canAdd is false', () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <DiagramTabs diagrams={diagrams} activeId="d1" dirtyIds={new Set()} canAdd dispatch={dispatch} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add diagram/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'addDiagram' });
    rerender(
      <DiagramTabs
        diagrams={diagrams}
        activeId="d1"
        dirtyIds={new Set()}
        canAdd={false}
        dispatch={dispatch}
      />,
    );
    expect(screen.getByRole('button', { name: /add diagram/i })).toBeDisabled();
  });
});
