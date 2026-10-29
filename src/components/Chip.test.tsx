import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterChips, ToggleChip } from './Chip';

const options = [
  { id: '', label: 'All' },
  { id: 'a', label: 'Alpha' },
] as const;

describe('Chip', () => {
  it('FilterChips is a labelled group with one pressed chip', () => {
    const onChange = vi.fn();
    render(<FilterChips label="Filter" options={options} value="a" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Filter' })).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('a chip is a 44 px pill, ink when pressed', () => {
    render(<FilterChips label="Filter" options={options} value="a" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveClass('min-h-11', 'rounded-full', 'bg-ink', 'text-on-ink');
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('bg-surface-2');
  });

  it('ToggleChip toggles and exposes its aria label', () => {
    const onToggle = vi.fn();
    render(<ToggleChip pressed={false} onToggle={onToggle} label="Grid" ariaLabel="Show grid" />);
    const chip = screen.getByRole('button', { name: 'Show grid' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
