import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Stopwatch } from './Stopwatch';

describe('Stopwatch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts, runs, and records the elapsed seconds on stop', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord.mock.calls[0][0]).toBeCloseTo(2, 1);
  });

  it('records the exact elapsed time at the instant Stop is pressed, not the last 100ms interval tick', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => {
      vi.advanceTimersByTime(2150);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(onRecord.mock.calls[0][0]).toBeCloseTo(2.15, 2);
  });

  it('resets to zero and is ready to start again after stopping', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
  });

  it('requires a second tap on Reset within the confirm window before clearing a running timer', () => {
    const onRecord = vi.fn();
    render(<Stopwatch onRecord={onRecord} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    act(() => vi.advanceTimersByTime(3000));

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(onRecord).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(screen.getByText('0.0s')).toBeInTheDocument();
    expect(onRecord).not.toHaveBeenCalled();
  });
});
