import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScrollStrip } from './ScrollStrip';

function size(el: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
}

describe('ScrollStrip', () => {
  it('scrolls horizontally without a scrollbar', () => {
    render(<ScrollStrip aria-label="Chips" role="group"><button>One</button></ScrollStrip>);
    expect(screen.getByRole('group', { name: 'Chips' })).toHaveClass('scroll-strip', 'overflow-x-auto');
  });

  it('fades only the edges that hide content', () => {
    render(<ScrollStrip role="group" aria-label="Chips"><button>One</button></ScrollStrip>);
    const strip = screen.getByRole('group', { name: 'Chips' });
    size(strip, { scrollWidth: 600, clientWidth: 300 });
    fireEvent.scroll(strip, { target: { scrollLeft: 0 } });
    expect(strip).not.toHaveAttribute('data-fade-start');
    expect(strip).toHaveAttribute('data-fade-end');
    fireEvent.scroll(strip, { target: { scrollLeft: 150 } });
    expect(strip).toHaveAttribute('data-fade-start');
    expect(strip).toHaveAttribute('data-fade-end');
    fireEvent.scroll(strip, { target: { scrollLeft: 300 } });
    expect(strip).toHaveAttribute('data-fade-start');
    expect(strip).not.toHaveAttribute('data-fade-end');
  });

  it('does not fade when everything fits', () => {
    render(<ScrollStrip role="group" aria-label="Chips"><button>One</button></ScrollStrip>);
    const strip = screen.getByRole('group', { name: 'Chips' });
    size(strip, { scrollWidth: 300, clientWidth: 300 });
    fireEvent.scroll(strip, { target: { scrollLeft: 0 } });
    expect(strip).not.toHaveAttribute('data-fade-start');
    expect(strip).not.toHaveAttribute('data-fade-end');
  });
});
