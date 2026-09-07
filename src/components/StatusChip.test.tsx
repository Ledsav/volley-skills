import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip, STATUS_OPTIONS } from './StatusChip';

describe('StatusChip', () => {
  it('lists all 5 statuses in STATUS_OPTIONS', () => {
    expect(STATUS_OPTIONS).toEqual(['Not started', 'In progress', 'Active', 'Attention', 'Completed']);
  });

  it('renders Active with the green tint class', () => {
    render(<StatusChip status="Active" />);
    expect(screen.getByText('Active')).toHaveClass('bg-green/10', 'text-green');
  });

  it('renders Completed with the solid ink fill', () => {
    render(<StatusChip status="Completed" />);
    expect(screen.getByText('Completed')).toHaveClass('bg-ink', 'text-white');
  });

  it('renders Not started with the muted slate treatment', () => {
    render(<StatusChip status="Not started" />);
    expect(screen.getByText('Not started')).toHaveClass('bg-bg', 'text-slate');
  });
});
