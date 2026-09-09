import { render, screen, fireEvent } from '@testing-library/react';
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
});
