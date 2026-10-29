import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(() => {
  // @ts-expect-error restore jsdom's absence of matchMedia
  delete window.matchMedia;
});

function setup(props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmDialog title="Delete player?" message="This cannot be undone." confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} {...props} />);
  return { onConfirm, onCancel };
}

describe('ConfirmDialog', () => {
  it('is an alertdialog named by its title with Cancel focused', () => {
    setup();
    expect(screen.getByRole('alertdialog', { name: 'Delete player?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirm calls onConfirm, Cancel and Escape call onCancel', () => {
    const { onConfirm, onCancel } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('the destructive confirm uses the red text token; the default tone does not', () => {
    const { unmount } = render(<ConfirmDialog title="T" message="M" confirmLabel="Delete" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('text-red-strong');
    unmount();
    render(<ConfirmDialog title="T" message="M" confirmLabel="Continue" tone="default" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Continue' }).className).not.toContain('text-red-strong');
  });

  it('shows the error as an alert', () => {
    setup({ error: 'Could not delete.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not delete.');
  });

  it('on a phone it renders as an action sheet', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width: 767px'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    setup();
    expect(screen.getByRole('alertdialog')).toHaveAttribute('data-layout', 'sheet');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });
});
