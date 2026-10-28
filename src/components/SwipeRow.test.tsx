import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SwipeRow, swipeRelease } from './SwipeRow';

const base = { width: 360, actionsWidth: 76 };

describe('swipeRelease', () => {
  it.each([
    [{ offset: -200, velocity: 0, fullSwipe: true }, 'commit'],
    [{ offset: -200, velocity: 0, fullSwipe: false }, 'open'],
    [{ offset: -20, velocity: -0.5, fullSwipe: false }, 'open'],
    [{ offset: -20, velocity: 0, fullSwipe: true }, 'closed'],
  ] as const)('%j -> %s', (input, expected) => {
    expect(swipeRelease({ ...base, ...input })).toBe(expected);
  });
});

function stubPointer(coarse: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: query.includes('pointer: coarse') ? coarse : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
}

describe('SwipeRow', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders trailing actions as hidden buttons until opened', () => {
    stubPointer(true);
    const onAction = vi.fn();
    const { container } = render(
      <SwipeRow trailing={[{ label: 'Delete', tone: 'destructive', undoable: true, onAction }]}>
        <p>Row</p>
      </SwipeRow>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-state', 'closed');
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    const button = screen.getByRole('button', { name: 'Delete', hidden: true });
    expect(button.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(button).toHaveAttribute('tabindex', '-1');
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does nothing on fine pointers', () => {
    stubPointer(false);
    const { container } = render(
      <SwipeRow trailing={[{ label: 'Delete', tone: 'destructive', undoable: true, onAction: vi.fn() }]}>
        <p>Row</p>
      </SwipeRow>,
    );
    expect(screen.queryByRole('button', { hidden: true })).toBeNull();
    expect(container.querySelector('[style*="transform"]')).toBeNull();
    expect(screen.getByText('Row')).toBeInTheDocument();
  });
});
