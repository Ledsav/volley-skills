import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { createItem } from './sceneFactory';

describe('PropertiesPanel', () => {
  it('shows a hint when nothing is selected', () => {
    render(<PropertiesPanel item={null} dispatch={vi.fn()} />);
    expect(screen.getByText(/select an element/i)).toBeInTheDocument();
  });

  it('edits a player label via setItemProp', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('player', { x: 10, y: 10 }), id: 'p1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} />);
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'OH' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'p1', patch: { label: 'OH' } });
  });

  it('changes colour from a swatch', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('cone', { x: 10, y: 10 }), id: 'c1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: 'green' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'c1', patch: { color: 'green' } });
  });

  it('deletes the selected item', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('ball', { x: 10, y: 10 }), id: 'b1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteItem', id: 'b1' });
  });
});
