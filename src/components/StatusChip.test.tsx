import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';

describe('StatusChip', () => {
  it('lists all 5 statuses in STATUS_OPTIONS', () => {
    expect(STATUS_OPTIONS).toEqual(['Not started', 'In progress', 'Active', 'Attention', 'Completed']);
  });

  it('renders Active with the green tint class', () => {
    render(<StatusChip status="Active" />);
    expect(screen.getByText('Active')).toHaveClass('bg-green-tint', 'text-green-strong');
  });

  it('renders Completed with the solid, self-inverting fill', () => {
    // bg-ink/text-on-ink so this chip still inverts correctly in dark mode.
    render(<StatusChip status="Completed" />);
    expect(screen.getByText('Completed')).toHaveClass('bg-ink', 'text-on-ink');
  });

  it('renders Not started with the muted slate treatment', () => {
    render(<StatusChip status="Not started" />);
    expect(screen.getByText('Not started')).toHaveClass('bg-surface-2', 'text-ink-2');
  });
});
