import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Switch, SwitchRow } from './Switch';

describe('Switch', () => {
  it('is a labelled switch that toggles', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Snap" />);
    const control = screen.getByRole('switch', { name: 'Snap' });
    expect(control).not.toBeChecked();
    fireEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('SwitchRow names the switch by its label and describes it, and the label toggles it', () => {
    const onChange = vi.fn();
    render(<SwitchRow label="AI features" description="Drafting and text scouting" checked onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'AI features' });
    expect(control).toBeChecked();
    expect(control).toHaveAccessibleDescription('Drafting and text scouting');
    fireEvent.click(screen.getByText('AI features'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('a disabled switch does not toggle', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} aria-label="Snap" disabled />);
    expect(screen.getByRole('switch', { name: 'Snap' })).toBeDisabled();
  });
});
