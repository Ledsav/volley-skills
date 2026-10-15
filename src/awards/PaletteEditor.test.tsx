// src/awards/PaletteEditor.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaletteEditor } from './PaletteEditor';

describe('PaletteEditor', () => {
  it('creates a named 4-colour palette by default and can add a fifth colour', () => {
    const onSave = vi.fn();
    render(<PaletteEditor initial={null} onSave={onSave} onCancel={vi.fn()} />);
    expect(screen.getAllByLabelText(/^Colour \d$/)).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Add colour' }));
    expect(screen.getAllByLabelText(/^Colour \d$/)).toHaveLength(5);
    expect(screen.getByRole('button', { name: 'Add colour' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: 'Club night' } });
    fireEvent.change(screen.getByLabelText('Colour 1'), { target: { value: '#ff0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('Club night');
    expect(saved.colors).toHaveLength(5);
    expect(saved.colors[0]).toBe('#FF0000');
    expect(saved.id).toMatch(/^custom-/);
  });

  it('cannot go below four colours and requires a name', () => {
    render(<PaletteEditor initial={null} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Remove colour 4' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Palette name'), { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Save palette' })).toBeDisabled();
  });

  it('edits an existing palette keeping its id, and can delete it', () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const initial = { id: 'custom-1', name: 'Mine', colors: ['#000000', '#111111', '#222222', '#333333'] };
    render(<PaletteEditor initial={initial} onSave={onSave} onDelete={onDelete} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save palette' }));
    expect(onSave.mock.calls[0][0].id).toBe('custom-1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete palette' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
