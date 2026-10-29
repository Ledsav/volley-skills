import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './Menu';

function renderMenu(onExport = vi.fn(), onToggle = vi.fn()) {
  render(
    <>
      <p>Outside</p>
      <Menu
        label="Export"
        trigger="Export"
        items={[
          { kind: 'action', label: 'Print / PDF', onSelect: onExport },
          { kind: 'check', label: 'Quick score', checked: true, onSelect: onToggle },
          { kind: 'divider' },
          { kind: 'action', label: 'Sign out', onSelect: vi.fn(), danger: true },
        ]}
      />
    </>,
  );
  return screen.getByRole('button', { name: 'Export' });
}

describe('Menu', () => {
  it('opens a labelled menu and runs the chosen item, then closes', () => {
    const onExport = vi.fn();
    const trigger = renderMenu(onExport);
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Quick score' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print / PDF' }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('focuses the first item, moves with arrow keys, and Escape returns focus to the trigger', () => {
    const trigger = renderMenu();
    fireEvent.click(trigger);
    const first = screen.getByRole('menuitem', { name: 'Print / PDF' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitemcheckbox', { name: 'Quick score' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside', () => {
    const trigger = renderMenu();
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByText('Outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a disabled item is announced and does nothing', () => {
    const onSelect = vi.fn();
    render(<Menu label="More" trigger="More" items={[{ kind: 'action', label: 'Import', onSelect, disabled: true }, { kind: 'action', label: 'Other', onSelect: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const item = screen.getByRole('menuitem', { name: 'Import' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item.className).toContain('text-ink-3');
    fireEvent.click(item);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: 'More' })).toBeInTheDocument();
    // Still reachable with the arrow keys.
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' });
    expect(item).toHaveFocus();
  });

  it('lines labels up: with a check item, every row keeps the leading column', () => {
    fireEvent.click(renderMenu());
    for (const name of ['Print / PDF', 'Quick score', 'Sign out']) {
      const row = screen.getByRole(name === 'Quick score' ? 'menuitemcheckbox' : 'menuitem', { name });
      expect(row.firstElementChild).toHaveClass('w-4');
    }
  });

  it('is glass by default and solid on request (over the scouting court)', () => {
    const { unmount } = render(<Menu label="Tools" trigger="Tools" items={[{ kind: 'action', label: 'Exit', onSelect: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('menu')).toHaveClass('glass');
    unmount();
    render(<Menu label="Tools" trigger="Tools" material="solid" items={[{ kind: 'action', label: 'Exit', onSelect: vi.fn() }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
    expect(screen.getByRole('menu')).toHaveClass('bg-surface');
    expect(screen.getByRole('menu')).not.toHaveClass('glass');
  });
});
