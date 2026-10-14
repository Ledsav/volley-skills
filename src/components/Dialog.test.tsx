import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('renders its title and children inside a modal dialog', () => {
    render(
      <Dialog title="Edit contact" onClose={vi.fn()}>
        <p>Body content</p>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit contact');
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );

    fireEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Dialog>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on an input inside it when the parent re-renders with a new onClose reference', () => {
    function Wrapper() {
      const [value, setValue] = useState('');
      // Intentionally recreated on every render, like an inline handler would be.
      const onClose = () => {};
      return (
        <Dialog title="Edit contact" onClose={onClose}>
          <input aria-label="Name" value={value} onChange={(e) => setValue(e.target.value)} />
        </Dialog>
      );
    }

    render(<Wrapper />);

    const input = screen.getByLabelText('Name');
    input.focus();
    fireEvent.change(input, { target: { value: 'a' } });

    expect(document.activeElement).toBe(input);
  });

  it('fills the viewport edge-to-edge on mobile when mobileSheet is set, without changing default behavior otherwise', () => {
    const { rerender } = render(
      <Dialog title="Session recording" onClose={vi.fn()} mobileSheet>
        <p>Body</p>
      </Dialog>
    );

    expect(screen.getByRole('dialog').className).toMatch(/h-full/);
    expect(screen.getByRole('dialog').className).toMatch(/rounded-none/);

    rerender(
      <Dialog title="Session recording" onClose={vi.fn()}>
        <p>Body</p>
      </Dialog>
    );

    expect(screen.getByRole('dialog').className).not.toMatch(/h-full/);
    expect(screen.getByRole('dialog').className).toMatch(/rounded-lg/);
  });

  it('keeps Tab focus inside the dialog, wrapping at both ends', () => {
    render(
      <>
        <button>Outside</button>
        <Dialog title="Edit contact" onClose={vi.fn()}>
          <input aria-label="First field" />
          <button>Save</button>
        </Dialog>
      </>
    );
    const close = screen.getByRole('button', { name: 'Close' });
    const save = screen.getByRole('button', { name: 'Save' });
    save.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(save).toHaveFocus();
  });

  it('returns focus to the element that opened it when it closes', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Dialog title="Edit contact" onClose={() => setOpen(false)}>
              <p>Body</p>
            </Dialog>
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(opener).toHaveFocus();
  });

  it('asks before discarding unsaved changes on backdrop, Escape or close', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="New training" onClose={onClose} dirty>
        <p>Body</p>
      </Dialog>
    );
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' }); // closes only the confirm (top layer)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('with guardUnsaved, closes freely until something is edited, then asks', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Dialog title="Edit skills" onClose={onClose} guardUnsaved>
        <input aria-label="Serve" />
      </Dialog>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    render(
      <Dialog title="Edit skills" onClose={onClose} guardUnsaved>
        <input aria-label="Serve" />
      </Dialog>
    );
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '7' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });
});
