import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider';
import { NoticeProvider, UNDO_MS, useNotify, useUndoable, type UndoableOptions } from './Notice';

function Harness({ opts, second }: { opts: UndoableOptions; second?: UndoableOptions }) {
  const undoable = useUndoable();
  const notify = useNotify();
  return (
    <div>
      <button onClick={() => undoable(opts)}>del</button>
      {second && <button onClick={() => undoable(second)}>del2</button>}
      <button onClick={() => notify('Plain message')}>plain</button>
      <input aria-label="field" />
    </div>
  );
}

function Nav() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/b')}>go</button>;
}

function setup(opts: UndoableOptions, second?: UndoableOptions, router = false) {
  const ui = (
    <I18nProvider>
      <NoticeProvider>
        {router && <Nav />}
        <Harness opts={opts} second={second} />
      </NoticeProvider>
    </I18nProvider>
  );
  return render(router ? <MemoryRouter>{ui}</MemoryRouter> : ui);
}

const opts = (over: Partial<UndoableOptions> = {}): UndoableOptions => ({
  message: 'Deleted',
  commit: vi.fn(),
  onUndo: vi.fn(),
  ...over,
});

describe('useUndoable', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('commits after 6 seconds', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted');
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(o.commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(o.commit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('Undo restores and never commits', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(o.onUndo).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(UNDO_MS * 2));
    expect(o.commit).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('a second undoable commits the first at once', () => {
    const a = opts({ message: 'First' });
    const b = opts({ message: 'Second' });
    setup(a, b);
    fireEvent.click(screen.getByText('del'));
    fireEvent.click(screen.getByText('del2'));
    expect(a.commit).toHaveBeenCalledTimes(1);
    expect(b.commit).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Second');
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(a.commit).toHaveBeenCalledTimes(1);
    expect(b.commit).toHaveBeenCalledTimes(1);
  });

  it('leaving the route commits the pending delete exactly once', () => {
    const o = opts();
    setup(o, undefined, true);
    fireEvent.click(screen.getByText('del'));
    fireEvent.click(screen.getByText('go'));
    expect(o.commit).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(UNDO_MS * 2));
    expect(o.commit).toHaveBeenCalledTimes(1);
  });

  it('pagehide commits exactly once', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
      window.dispatchEvent(new Event('pagehide'));
    });
    act(() => vi.advanceTimersByTime(UNDO_MS * 2));
    expect(o.commit).toHaveBeenCalledTimes(1);
  });

  it('unmounting the provider commits the pending one', () => {
    const o = opts();
    const { unmount } = setup(o);
    fireEvent.click(screen.getByText('del'));
    unmount();
    expect(o.commit).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Z triggers undo, but not inside a text field', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'z', ctrlKey: true });
    expect(o.onUndo).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Deleted');
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(o.onUndo).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('Ctrl+Z is ignored inside [data-own-undo] and when already handled', () => {
    const o = opts();
    const { container } = setup(o);
    const own = document.createElement('div');
    own.setAttribute('data-own-undo', '');
    own.tabIndex = 0;
    container.appendChild(own);
    fireEvent.click(screen.getByText('del'));
    fireEvent.keyDown(own, { key: 'z', ctrlKey: true });
    expect(o.onUndo).not.toHaveBeenCalled();
    const early = (e: KeyboardEvent) => e.preventDefault();
    document.addEventListener('keydown', early);
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    document.removeEventListener('keydown', early);
    expect(o.onUndo).not.toHaveBeenCalled();
  });

  it('hovering pauses the timer', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    const pill = screen.getByRole('button', { name: 'Undo' });
    act(() => vi.advanceTimersByTime(3000));
    fireEvent.pointerEnter(pill);
    act(() => vi.advanceTimersByTime(UNDO_MS * 3));
    expect(o.commit).not.toHaveBeenCalled();
    fireEvent.pointerLeave(pill);
    act(() => vi.advanceTimersByTime(UNDO_MS - 1));
    expect(o.commit).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(o.commit).toHaveBeenCalledTimes(1);
  });

  it('a plain notice waits for the undo notice to close', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    fireEvent.click(screen.getByText('plain'));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted');
    expect(screen.getByRole('status')).not.toHaveTextContent('Plain message');
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(screen.getByRole('status')).toHaveTextContent('Plain message');
  });

  it('a failed commit reports through onCommitError', async () => {
    const error = new Error('nope');
    const rejected = opts({ commit: vi.fn().mockRejectedValue(error), onCommitError: vi.fn() });
    const first = setup(rejected);
    fireEvent.click(screen.getByText('del'));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(rejected.onCommitError).toHaveBeenCalledWith(error);
    first.unmount();

    const thrown = opts({
      commit: vi.fn(() => {
        throw error;
      }),
      onCommitError: vi.fn(),
    });
    setup(thrown);
    fireEvent.click(screen.getByText('del'));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(thrown.onCommitError).toHaveBeenCalledWith(error);
  });

  it('pagehide also closes the undo notice', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(o.commit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('commits and closes when the page becomes hidden', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    const spy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    spy.mockRestore();
    expect(o.commit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('Undo hands focus back to the element that started the delete', () => {
    const o = opts();
    setup(o);
    const del = screen.getByText('del');
    del.focus();
    fireEvent.click(del);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(del).toHaveFocus();
  });

  it('Ctrl+Z is ignored from an SVG inside [data-own-undo]', () => {
    const o = opts();
    const { container } = setup(o);
    const own = document.createElement('div');
    own.setAttribute('data-own-undo', '');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    own.appendChild(svg);
    container.appendChild(own);
    fireEvent.click(screen.getByText('del'));
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(o.onUndo).not.toHaveBeenCalled();
  });

  it('stays paused while focus is inside after the pointer leaves', () => {
    const o = opts();
    setup(o);
    fireEvent.click(screen.getByText('del'));
    const button = screen.getByRole('button', { name: 'Undo' });
    fireEvent.pointerEnter(button);
    fireEvent.focus(button);
    fireEvent.pointerLeave(button);
    act(() => vi.advanceTimersByTime(UNDO_MS * 3));
    expect(o.commit).not.toHaveBeenCalled();
    fireEvent.blur(button);
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(o.commit).toHaveBeenCalledTimes(1);
  });

  it('resets the pause flags per notice: a hold left by an undone notice does not freeze the next one', () => {
    const a = opts();
    const b = opts({ message: 'Deleted again' });
    setup(a, b);
    fireEvent.click(screen.getByText('del'));
    const undoA = screen.getByRole('button', { name: 'Undo' });
    fireEvent.pointerEnter(undoA);
    fireEvent.click(undoA); // the pill unmounts under the pointer: no pointerleave
    fireEvent.click(screen.getByText('del2'));
    const undoB = screen.getByRole('button', { name: 'Undo' });
    fireEvent.focus(undoB);
    fireEvent.blur(undoB);
    act(() => vi.advanceTimersByTime(UNDO_MS));
    expect(b.commit).toHaveBeenCalledTimes(1);
    expect(a.commit).not.toHaveBeenCalled();
  });

  it('logs a failed commit when there is no onCommitError', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('boom');
    const o = opts({ commit: vi.fn().mockRejectedValue(error) });
    setup(o);
    fireEvent.click(screen.getByText('del'));
    await act(async () => {
      vi.advanceTimersByTime(UNDO_MS);
    });
    expect(spy).toHaveBeenCalledWith(error);
    spy.mockRestore();
  });
});
