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
});
