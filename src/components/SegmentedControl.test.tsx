import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
  { id: 'c', label: 'Charlie' },
] as const;

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('SegmentedControl', () => {
  it('radio semantics: one checked radio, click selects', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Mode" options={options} value="a" onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'Bravo' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('tabs semantics: tablist with the selected tab', () => {
    render(<SegmentedControl label="Sections" options={options} value="b" onChange={vi.fn()} semantics="tabs" />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Bravo' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves selection and focus; End selects the last', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Mode" options={options} value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Bravo' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Bravo' }), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c'); // wraps
  });

  it('long labels never wrap: the track keeps nowrap and horizontal scrolling', () => {
    const { rerender } = render(<SegmentedControl label="Mode" options={options} value="a" onChange={vi.fn()} />);
    const track = screen.getByRole('radiogroup');
    expect(track.className).toContain('whitespace-nowrap');
    expect(track.className).toContain('overflow-x-auto');
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    rerender(<SegmentedControl label="Mode" options={options} value="c" onChange={vi.fn()} />);
    expect(scroll).toHaveBeenCalledWith({ inline: 'nearest', block: 'nearest' });
    expect(scroll.mock.contexts[scroll.mock.contexts.length - 1]).toBe(screen.getByRole('radio', { name: 'Charlie' }));
  });
});
