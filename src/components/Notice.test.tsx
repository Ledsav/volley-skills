import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoticeProvider, useNotify } from './Notice';

function Trigger({ message, durationMs }: { message: string; durationMs?: number }) {
  const notify = useNotify();
  return <button onClick={() => notify(message, { durationMs })}>go</button>;
}

describe('NoticeProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('announces a message in a polite live region and clears it after the duration', () => {
    render(<NoticeProvider><Trigger message="Imported 3 teams." /></NoticeProvider>);
    fireEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status')).toHaveTextContent('Imported 3 teams.');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('replaces the current message and restarts the timer', () => {
    const { rerender } = render(<NoticeProvider><Trigger message="First" /></NoticeProvider>);
    fireEvent.click(screen.getByText('go'));
    act(() => vi.advanceTimersByTime(3000));
    rerender(<NoticeProvider><Trigger message="Second" /></NoticeProvider>);
    fireEvent.click(screen.getByText('go'));
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('status')).toHaveTextContent('Second');
  });

  it('can be dismissed by hand', () => {
    render(<NoticeProvider><Trigger message="Done" durationMs={10000} /></NoticeProvider>);
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('clears its pending dismiss timer on unmount', () => {
    const { unmount } = render(<NoticeProvider><Trigger message="Bye" /></NoticeProvider>);
    fireEvent.click(screen.getByText('go'));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('is a no-op outside the provider', () => {
    render(<Trigger message="Nothing" />);
    expect(() => fireEvent.click(screen.getByText('go'))).not.toThrow();
  });
});
