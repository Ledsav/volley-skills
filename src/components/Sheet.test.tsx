import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Sheet, SheetCancelButton, useSheetClose } from './Sheet';
import { decideRelease } from './sheetRelease';

function mockPhone(reducedMotion = false) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width: 767px') || (reducedMotion && query.includes('prefers-reduced-motion')),
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
  it('a slow drag can close a short sheet because the threshold uses the visible height', () => {
    expect(decideRelease({ offset: 100, velocity: 0, height: 300, dirty: false })).toBe('close');
    expect(decideRelease({ offset: 100, velocity: 0, height: 600, dirty: false })).toBe('snap');
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
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
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

  it('phone with a footer shows no header Done, only the title and the hidden Close', () => {
    mockPhone();
    render(
      <Sheet title="Edit" onClose={vi.fn()} footer={<button>Save</button>}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('sr-only');
  });

  it('a view sheet shows Done and no Cancel in the phone header, even with a footer', () => {
    mockPhone();
    const onClose = vi.fn();
    render(
      <Sheet title="Plan" variant="view" onClose={onClose} footer={<button>Share</button>}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('SheetCancelButton asks to discard when the sheet is dirty and closes at once when clean', () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Sheet title="Edit" onClose={onClose} dirty footer={<SheetCancelButton />}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    unmount();
    render(
      <Sheet title="Edit" onClose={onClose} footer={<SheetCancelButton />}>
        <p>Body</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('phone with guardUnsaved or dirty shows no header Done', () => {
    mockPhone();
    const { unmount } = render(
      <Sheet title="Edit" onClose={vi.fn()} guardUnsaved>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    unmount();
    render(
      <Sheet title="Edit" onClose={vi.fn()} dirty>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
  });

  it('phone footer stays within the visible area at the content detent', () => {
    mockPhone(true);
    const heights: Record<string, number> = { dialog: 700, header: 50, inner: 100, footer: 60 };
    const spy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('role') === 'dialog') return heights.dialog;
      if (this.tagName === 'FOOTER') return heights.footer;
      if (this.parentElement?.className.includes('overflow-y-auto')) return heights.inner;
      if (this.className.includes('touch-none')) return heights.header;
      return 0;
    });
    try {
      render(
        <Sheet title="Edit" onClose={vi.fn()} footer={<button>Save</button>}>
          <p>Body</p>
        </Sheet>,
      );
      const y = parseFloat(/translateY\((-?[\d.]+)px\)/.exec(screen.getByRole('dialog').style.transform)![1]);
      const shift = parseFloat(/translateY\((-?[\d.]+)px\)/.exec(document.querySelector('footer')!.style.transform)![1]);
      // Content detent: panel (700) minus header, body and footer (50 + 100 + 60).
      expect(y).toBe(490);
      // The footer's bottom edge lands exactly on the screen bottom (offset 0), not below it.
      expect(y + shift).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('remounts the layout on phone to desktop, dropping the imperative scrim opacity', () => {
    let phone = true;
    const listeners = new Set<() => void>();
    window.matchMedia = ((query: string) => ({
      get matches() {
        return phone && query.includes('max-width: 767px');
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })) as unknown as typeof window.matchMedia;
    render(
      <Sheet title="Edit" onClose={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-layout', 'sheet');
    screen.getByTestId('dialog-backdrop').style.opacity = '0.5';
    act(() => {
      phone = false;
      listeners.forEach((fn) => (fn as (e: { matches: boolean }) => void)({ matches: false }));
    });
    const panel = screen.getByRole('dialog');
    expect(panel).toHaveAttribute('data-layout', 'dialog');
    expect(panel.style.opacity).toBe('');
    expect(screen.getByTestId('dialog-backdrop').style.opacity).toBe('');
  });
});

describe('Sheet (desktop dialog)', () => {
  it('renders its title and children inside a modal dialog', () => {
    render(
      <Sheet title="Edit contact" onClose={vi.fn()}>
        <p>Body content</p>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Edit contact');
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Sheet>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Sheet>
    );

    fireEvent.click(screen.getByText('Body'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the close button is activated', () => {
    const onClose = vi.fn();
    render(
      <Sheet title="Edit contact" onClose={onClose}>
        <p>Body</p>
      </Sheet>
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
        <Sheet title="Edit contact" onClose={onClose}>
          <input aria-label="Name" value={value} onChange={(e) => setValue(e.target.value)} />
        </Sheet>
      );
    }

    render(<Wrapper />);

    const input = screen.getByLabelText('Name');
    input.focus();
    fireEvent.change(input, { target: { value: 'a' } });

    expect(document.activeElement).toBe(input);
  });

  it('opens the large detent when detent is large, the content detent otherwise', () => {
    const { rerender } = render(
      <Sheet title="Session recording" onClose={vi.fn()} detent="large">
        <p>Body</p>
      </Sheet>
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'large');

    rerender(
      <Sheet title="Session recording" onClose={vi.fn()}>
        <p>Body</p>
      </Sheet>
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('data-detent', 'content');
  });

  it('keeps Tab focus inside the dialog, wrapping at both ends', () => {
    render(
      <>
        <button>Outside</button>
        <Sheet title="Edit contact" onClose={vi.fn()}>
          <input aria-label="First field" />
          <button>Save</button>
        </Sheet>
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
            <Sheet title="Edit contact" onClose={() => setOpen(false)}>
              <p>Body</p>
            </Sheet>
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
      <Sheet title="New training" onClose={onClose} dirty>
        <p>Body</p>
      </Sheet>
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
      <Sheet title="Edit skills" onClose={onClose} guardUnsaved>
        <input aria-label="Serve" />
      </Sheet>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    onClose.mockClear();
    render(
      <Sheet title="Edit skills" onClose={onClose} guardUnsaved>
        <input aria-label="Serve" />
      </Sheet>
    );
    fireEvent.change(screen.getByLabelText('Serve'), { target: { value: '7' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Discard changes?' })).toBeInTheDocument();
  });
});

describe('Sheet without a header', () => {
  it('desktop: no title row or close button, but the accessible name, Escape and focus return stay', () => {
    const onClose = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Sheet title="Welcome" header={false} onClose={() => { onClose(); setOpen(false); }}>
              <p>Body</p>
            </Sheet>
          )}
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Welcome');
    expect(dialog).toHaveFocus();
    expect(screen.queryByRole('heading', { name: 'Welcome' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it('phone: keeps the grabber and scrim close, drops the title, Done and the hidden Close', () => {
    mockPhone();
    const onClose = vi.fn();
    render(
      <Sheet title="Welcome" header={false} variant="view" onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Welcome');
    expect(dialog.querySelector('.rounded-full')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Welcome' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    fireEvent.click(screen.getByTestId('dialog-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
