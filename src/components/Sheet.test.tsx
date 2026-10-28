import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideRelease, Sheet, useSheetClose } from './Sheet';

function mockPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  // @ts-expect-error restore jsdom's absence of matchMedia
  delete window.matchMedia;
});

function CancelButton() {
  const close = useSheetClose();
  return <button onClick={close}>Cancel inside</button>;
}

describe('decideRelease', () => {
  it('closes on a downward flick', () => {
    expect(decideRelease({ offset: 10, velocity: 0.8, height: 500, dirty: false })).toBe('close');
  });
  it('closes past 30% of the height', () => {
    expect(decideRelease({ offset: 200, velocity: 0, height: 500, dirty: false })).toBe('close');
  });
  it('guards instead of closing when dirty', () => {
    expect(decideRelease({ offset: 200, velocity: 0, height: 500, dirty: true })).toBe('guard');
  });
  it('snaps back otherwise', () => {
    expect(decideRelease({ offset: 50, velocity: 0.1, height: 500, dirty: false })).toBe('snap');
  });
});

describe('Sheet', () => {
  it('Cancel inside a dirty sheet asks Discard changes? and keeps the sheet open', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit" onClose={onClose} dirty>
        <CancelButton />
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel inside' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a clean sheet closes on Cancel', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit" onClose={onClose}>
        <CancelButton />
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel inside' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape with the discard alert open closes only the alert', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit" onClose={onClose} dirty>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('desktop shows a footer Cancel and confirm instead of a header confirm', () => {
    const onConfirm = vi.fn();
    render(
      <Sheet title="Edit" onClose={vi.fn()} confirm={{ label: 'Save', onConfirm }}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('confirm in the header submits its form', () => {
    mockPhone();
    render(
      <Sheet title="Edit" onClose={vi.fn()} confirm={{ label: 'Save', form: 'f' }}>
        <form id="f" />
      </Sheet>,
    );
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toHaveAttribute('type', 'submit');
    expect(save).toHaveAttribute('form', 'f');
  });

  it('phone layout shows Cancel and Done instead of ✕, keeping an accessible Close', () => {
    mockPhone();
    const onClose = vi.fn();
    render(
      <Sheet title="Edit" onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'sheet');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('sr-only');
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
