import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';
import { createItem } from './sceneFactory';
import type { PlayerItem } from '../types/diagram';

describe('PropertiesPanel', () => {
  it('shows a hint when nothing is selected', () => {
    render(<PropertiesPanel item={null} dispatch={vi.fn()} selectedCount={0} />);
    expect(screen.getByText(/select an element/i)).toBeInTheDocument();
  });

  it('edits a player label via setItemProp', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('player', { x: 10, y: 10 }), id: 'p1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'OH' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'p1', patch: { label: 'OH' } });
  });

  it('edits the font size of a text item', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('text', { x: 10, y: 10 }), id: 't1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);
    fireEvent.change(screen.getByLabelText(/font size/i), { target: { value: '7' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 't1', patch: { fontSize: 7 } });
  });

  it('changes colour from a swatch', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('cone', { x: 10, y: 10 }), id: 'c1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);
    fireEvent.click(screen.getByRole('button', { name: 'green' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'c1', patch: { color: 'green' } });
  });

  it('deletes the selected item', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('ball', { x: 10, y: 10 }), id: 'b1' };
    render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteItem', id: 'b1' });
  });

  it('shows a compact multi panel when more than one element is selected', () => {
    const dispatch = vi.fn();
    render(<PropertiesPanel item={null} dispatch={dispatch} selectedCount={3} />);
    expect(screen.getByText('3 elements selected')).toBeInTheDocument();
    // No per-field editors or colour swatches in multi mode.
    expect(screen.queryByRole('button', { name: 'green' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'deleteSelected' });

    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'translateSelected', dx: 1, dy: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Nudge up' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'translateSelected', dx: 0, dy: -1 });
  });

  it('changes a player view and only offers Shape for the token view', () => {
    const dispatch = vi.fn();
    const item: PlayerItem = {
      ...(createItem('player', { x: 10, y: 10 }) as PlayerItem),
      id: 'p2',
      view: 'above',
    };
    const { rerender } = render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);

    // A non-token view hides the circle/square Shape control.
    expect(screen.queryByLabelText(/shape/i)).toBeNull();

    fireEvent.change(screen.getByLabelText(/view/i), { target: { value: 'spike' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'p2', patch: { view: 'spike' } });

    rerender(
      <PropertiesPanel item={{ ...item, view: 'token' }} dispatch={dispatch} selectedCount={1} />,
    );
    fireEvent.change(screen.getByLabelText(/shape/i), { target: { value: 'square' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'p2', patch: { shape: 'square' } });
  });

  it('switches a ball between plain and mikasa styles', () => {
    const dispatch = vi.fn();
    const item = { ...createItem('ball', { x: 10, y: 10 }), id: 'b2' };
    render(<PropertiesPanel item={item} dispatch={dispatch} selectedCount={1} />);
    fireEvent.change(screen.getByLabelText(/style/i), { target: { value: 'mikasa' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setItemProp', id: 'b2', patch: { style: 'mikasa' } });
  });

  it('renders the single-item editor when exactly one element is selected', () => {
    const item = { ...createItem('player', { x: 10, y: 10 }), id: 'p9' };
    render(<PropertiesPanel item={item} dispatch={vi.fn()} selectedCount={1} />);
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.queryByText(/elements selected/i)).toBeNull();
  });
});
