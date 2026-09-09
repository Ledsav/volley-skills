import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditButton } from './EditButton';

describe('EditButton', () => {
  it('renders the label and calls onClick when activated', () => {
    const onClick = vi.fn();
    render(<EditButton label="Edit skills" onClick={onClick} />);

    const button = screen.getByRole('button', { name: 'Edit skills' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults its label to "Edit"', () => {
    render(<EditButton onClick={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
