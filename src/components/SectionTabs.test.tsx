import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionTabs } from './SectionTabs';

const tabs = [
  { id: 'skills', label: 'Skills' },
  { id: 'plan', label: 'Plan' },
] as const;

describe('SectionTabs', () => {
  it('offers the sections as tabs that switch sections', () => {
    const onChange = vi.fn();
    render(<SectionTabs label="Player sections" tabs={tabs} active="skills" onChange={onChange} />);
    expect(screen.getByRole('tablist', { name: 'Player sections' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Skills', 'Plan']);
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    expect(onChange).toHaveBeenLastCalledWith('plan');
  });
});
