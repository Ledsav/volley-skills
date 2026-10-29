import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { SearchProvider, useSearch } from './SearchProvider';

function Probe() {
  const { open, isOpen } = useSearch();
  return (
    <button onClick={open}>
      probe {String(isOpen)}
    </button>
  );
}

function setup() {
  return render(
    <MemoryRouter>
      <SearchProvider>
        <Probe />
      </SearchProvider>
    </MemoryRouter>
  );
}

const ctrlK = () => {
  const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
};

let afterDialog: HTMLElement | null = null;
afterEach(() => {
  afterDialog?.remove();
  afterDialog = null;
  window.history.pushState({}, '', '/');
});

describe('SearchProvider', () => {
  it('Ctrl+K opens and Ctrl+K again closes', () => {
    setup();
    expect(ctrlK().defaultPrevented).toBe(true);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('probe true')).toBeInTheDocument();
    ctrlK();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('the open button opens the palette', () => {
    setup();
    fireEvent.click(screen.getByText('probe false'));
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not open while a modal dialog is open', () => {
    setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    afterDialog = dialog;
    const event = ctrlK();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not open while an alert dialog (ConfirmDialog) is open', () => {
    setup();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    document.body.appendChild(dialog);
    afterDialog = dialog;
    const event = ctrlK();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(event.defaultPrevented).toBe(false);
  });

  it('open() while already open keeps the first opener', () => {
    setup();
    const opener = screen.getByText('probe false');
    opener.focus();
    fireEvent.click(opener);
    const input = screen.getByRole('combobox');
    act(() => {
      input.focus();
    });
    // A second open while open (e.g. the open button again) must not make the input the opener.
    fireEvent.click(screen.getByText('probe true'));
    ctrlK();
    expect(document.activeElement).toBe(opener);
  });

  it('does not open on the diagram editor route', () => {
    window.history.pushState({}, '', '/exercises/e1/diagram');
    setup();
    expect(ctrlK().defaultPrevented).toBe(false);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('restores focus to the opener on close', () => {
    setup();
    const opener = screen.getByText('probe false');
    opener.focus();
    ctrlK();
    expect(document.activeElement).not.toBe(opener);
    ctrlK();
    expect(document.activeElement).toBe(opener);
  });
});
