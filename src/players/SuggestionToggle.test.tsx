import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SuggestionToggle } from './SuggestionToggle';

describe('SuggestionToggle', () => {
  it('is a pressed/unpressed button that flips on click', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SuggestionToggle on onChange={onChange} />);
    const btn = screen.getByRole('button', { name: 'Match suggestions' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(false);
    rerender(<SuggestionToggle on={false} onChange={onChange} />);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });
});
