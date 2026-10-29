import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_MS, useContextMenu } from './ContextMenu';

// jsdom has no PointerEvent; testing-library only copies pointerType/clientX onto a real subclass.
class TestPointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? '';
  }
}

function Harness({ onRun = vi.fn(), onParentClick = vi.fn() }: { onRun?: () => void; onParentClick?: () => void }) {
  const { targetProps, menu } = useContextMenu({
    label: 'Row actions',
    items: [{ kind: 'action', label: 'Rename', onSelect: onRun }],
  });
  return (
    <div onClick={onParentClick}>
      <a href="#x" {...targetProps}>
        Row
      </a>
      {menu}
    </div>
  );
}

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('PointerEvent', TestPointerEvent);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('right-click opens a labelled menu at the pointer and runs an item', () => {
    const onRun = vi.fn();
    render(<Harness onRun={onRun} />);
    const allowed = fireEvent.contextMenu(screen.getByText('Row'), { clientX: 30, clientY: 40 });
    expect(allowed).toBe(false); // preventDefault was called
    const menu = screen.getByRole('menu', { name: 'Row actions' });
    expect(menu.style.left).toBe('30px');
    expect(menu.style.top).toBe('40px');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a touch long-press of 500 ms opens the menu', () => {
    render(<Harness />);
    fireEvent.pointerDown(screen.getByText('Row'), { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS - 1));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1));
    expect(screen.getByRole('menu', { name: 'Row actions' })).toBeInTheDocument();
  });

  it('moving more than 10 px cancels the long-press', () => {
    render(<Harness />);
    const row = screen.getByText('Row');
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerMove(row, { pointerType: 'touch', clientX: 22, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('the click after a long-press does not activate the row', () => {
    const onParentClick = vi.fn();
    render(<Harness onParentClick={onParentClick} />);
    const row = screen.getByText('Row');
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerUp(row, { pointerType: 'touch' });
    fireEvent.click(row);
    expect(onParentClick).not.toHaveBeenCalled();
    // an ordinary click afterwards works again
    fireEvent.click(row);
    expect(onParentClick).toHaveBeenCalledTimes(1);
  });

  it('Escape closes and returns focus to the row', () => {
    render(<Harness />);
    const row = screen.getByText('Row');
    fireEvent.contextMenu(row, { clientX: 5, clientY: 5 });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Rename' }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it('an outside pointer-down closes it', () => {
    render(<Harness />);
    fireEvent.contextMenu(screen.getByText('Row'), { clientX: 5, clientY: 5 });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('a keyboard context-menu key (clientX/Y 0) opens at the row, not the viewport corner', () => {
    render(<Harness />);
    const row = screen.getByText('Row');
    row.getBoundingClientRect = () => ({ left: 120, bottom: 64, top: 40, right: 200, width: 80, height: 24, x: 120, y: 40, toJSON: () => ({}) });
    fireEvent.contextMenu(row, { clientX: 0, clientY: 0 });
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('120px');
    expect(menu.style.top).toBe('64px');
  });

  it('pointercancel clears the swallow, and so does time after the press ends', () => {
    const onParentClick = vi.fn();
    render(<Harness onParentClick={onParentClick} />);
    const row = screen.getByText('Row');
    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerCancel(row, { pointerType: 'touch' });
    fireEvent.click(row);
    expect(onParentClick).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(row, { pointerType: 'touch', clientX: 10, clientY: 10 });
    act(() => void vi.advanceTimersByTime(LONG_PRESS_MS));
    fireEvent.pointerUp(row, { pointerType: 'touch' });
    act(() => void vi.advanceTimersByTime(400));
    fireEvent.click(row); // a later keyboard click is not swallowed
    expect(onParentClick).toHaveBeenCalledTimes(2);
  });
});
