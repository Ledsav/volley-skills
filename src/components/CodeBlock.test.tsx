import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the code and its language label', () => {
    render(<CodeBlock code='[{ "a": 1 }]' language="JSON" />);
    expect(screen.getByText('[{ "a": 1 }]')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('copies the code to the clipboard and briefly confirms it', async () => {
    vi.useFakeTimers();
    render(<CodeBlock code="[1, 2]" language="JSON" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(writeText).toHaveBeenCalledWith('[1, 2]');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
  });

  it('tells the user when the clipboard is unavailable', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<CodeBlock code="[]" language="JSON" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    });

    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
  });
});
