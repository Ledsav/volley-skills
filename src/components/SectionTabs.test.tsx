import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SectionTabs } from './SectionTabs';

const tabs = [
  { id: 'skills', label: 'Skills' },
  { id: 'plan', label: 'Plan' },
] as const;

describe('SectionTabs', () => {
  it('offers the same sections as a phone picker and as tabs, both switching sections', () => {
    const onChange = vi.fn();
    render(<SectionTabs label="Player sections" tabs={tabs} active="skills" onChange={onChange} />);
    expect(screen.getByRole('combobox', { name: 'Player sections' })).toHaveValue('skills');
    expect(screen.getByRole('tab', { name: 'Skills' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    expect(onChange).toHaveBeenLastCalledWith('plan');
    fireEvent.change(screen.getByRole('combobox', { name: 'Player sections' }), { target: { value: 'plan' } });
    expect(onChange).toHaveBeenLastCalledWith('plan');
  });
});
