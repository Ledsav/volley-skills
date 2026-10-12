import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';

const player = { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' as const };

describe('ActionSheet', () => {
  it('pre-selects the first skill and records a grade in one tap', () => {
    const onGrade = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A', 'S']} onGrade={onGrade} onSub={vi.fn()} onClose={vi.fn()} floating={false} />);
    expect(screen.getByRole('button', { name: 'Block' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '# Stuff' }));
    expect(onGrade).toHaveBeenCalledWith('B', '#');
  });

  it('hides grades a skill does not have', () => {
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A']} onGrade={vi.fn()} onSub={vi.fn()} onClose={vi.fn()} floating={false} />);
    expect(screen.queryByRole('button', { name: /^!/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    expect(screen.getByRole('button', { name: '! Covered' })).toBeInTheDocument();
  });

  it('offers a substitution', () => {
    const onSub = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B']} onGrade={vi.fn()} onSub={onSub} onClose={vi.fn()} floating={false} />);
    fireEvent.click(screen.getByRole('button', { name: /substitute/i }));
    expect(onSub).toHaveBeenCalled();
  });
});
