import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionSheet } from './ActionSheet';
import { SCOUT_GRADE_CLASS } from './gradeStyles';

const player = { playerId: 'mb1', number: 11, name: 'Marta', positionCategory: 'MB' as const };

describe('ActionSheet', () => {
  it('pre-selects the first skill and records a grade in one tap', () => {
    const onGrade = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A', 'S']} onGrade={onGrade} onSub={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Block' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '# Stuff' }));
    expect(onGrade).toHaveBeenCalledWith('B', '#');
  });

  it('hides grades a skill does not have', () => {
    render(<ActionSheet player={player} isLibero={false} skills={['B', 'A']} onGrade={vi.fn()} onSub={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /^!/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Attack' }));
    expect(screen.getByRole('button', { name: '! Covered' })).toBeInTheDocument();
  });

  it('offers a substitution', () => {
    const onSub = vi.fn();
    render(<ActionSheet player={player} isLibero={false} skills={['B']} onGrade={vi.fn()} onSub={onSub} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /substitute/i }));
    expect(onSub).toHaveBeenCalled();
  });

  it('grade chips use the grade colours: tint plus strong text, ! neutral', () => {
    render(<ActionSheet player={player} isLibero={false} skills={['A']} onGrade={vi.fn()} onSub={vi.fn()} onClose={vi.fn()} />);
    const perfect = screen.getByRole('button', { name: /^# / });
    for (const c of SCOUT_GRADE_CLASS['#'].split(' ')) expect(perfect).toHaveClass(c);
    const error = screen.getByRole('button', { name: /^= / });
    for (const c of SCOUT_GRADE_CLASS['='].split(' ')) expect(error).toHaveClass(c);
    expect(perfect).toHaveClass('bg-green', 'text-on-ink');
    expect(error).toHaveClass('bg-red', 'text-on-ink');
    const neutral = screen.getByRole('button', { name: /^! / });
    expect(neutral).toHaveClass('text-ink-2');
    expect(neutral).toHaveClass('bg-surface-2');
  });
});
