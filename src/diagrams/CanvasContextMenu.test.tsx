import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasContextMenu, type MenuAction } from './CanvasContextMenu';

function renderMenu(actions: MenuAction[], onClose = vi.fn()) {
  render(<CanvasContextMenu x={12} y={34} actions={actions} onClose={onClose} />);
  return onClose;
}

describe('CanvasContextMenu', () => {
  it('renders a menu with every action as a menuitem', () => {
    renderMenu([
      { label: 'Copy', onSelect: vi.fn() },
      { label: 'Paste', onSelect: vi.fn() },
    ]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Copy', 'Paste']);
  });

  it('positions itself at (x, y)', () => {
    renderMenu([{ label: 'Copy', onSelect: vi.fn() }]);
    const menu = screen.getByRole('menu');
    expect(menu).toHaveStyle({ left: '12px', top: '34px' });
  });

  it('calls the action then onClose when an item is clicked', () => {
    const onSelect = vi.fn();
    const onClose = renderMenu([{ label: 'Duplicate', onSelect }]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not fire a disabled action', () => {
    const onSelect = vi.fn();
    const onClose = renderMenu([{ label: 'Paste', onSelect, disabled: true }]);
    const item = screen.getByRole('menuitem', { name: 'Paste' });
    expect(item).toBeDisabled();
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = renderMenu([{ label: 'Copy', onSelect: vi.fn() }]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on an outside pointerdown but not on a click inside', () => {
    const onClose = renderMenu([{ label: 'Copy', onSelect: vi.fn() }]);
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on window scroll and resize', () => {
    const onClose = renderMenu([{ label: 'Copy', onSelect: vi.fn() }]);
    fireEvent.scroll(window);
    fireEvent.resize(window);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
