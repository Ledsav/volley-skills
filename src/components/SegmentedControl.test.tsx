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

  it('long labels never wrap: nowrap, horizontal scrolling, and the track (not the page) scrolls to the selection', () => {
    const page = vi.fn();
    Element.prototype.scrollIntoView = page;
    const { rerender } = render(<SegmentedControl label="Mode" options={options} value="a" onChange={vi.fn()} />);
    const track = screen.getByRole('radiogroup');
    expect(track.className).toContain('whitespace-nowrap');
    expect(track.className).toContain('overflow-x-auto');
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 100 });
    const charlie = screen.getByRole('radio', { name: 'Charlie' });
    Object.defineProperty(charlie, 'offsetLeft', { configurable: true, value: 260 });
    Object.defineProperty(charlie, 'offsetWidth', { configurable: true, value: 80 });
    rerender(<SegmentedControl label="Mode" options={options} value="c" onChange={vi.fn()} />);
    expect(track.scrollLeft).toBe(240); // right edge 340 - width 100
    expect(page).not.toHaveBeenCalled();
  });

  it('re-rendering with a new-but-equal options array does not scroll the track again', () => {
    const make = () => options.map((o) => ({ ...o }));
    const { rerender } = render(<SegmentedControl label="Mode" options={make()} value="c" onChange={vi.fn()} />);
    const track = screen.getByRole('radiogroup');
    const charlie = screen.getByRole('radio', { name: 'Charlie' });
    Object.defineProperty(charlie, 'offsetLeft', { configurable: true, value: 260 });
    Object.defineProperty(charlie, 'offsetWidth', { configurable: true, value: 80 });
    Object.defineProperty(track, 'clientWidth', { configurable: true, value: 100 });
    track.scrollLeft = 7; // the user scrolled by hand
    rerender(<SegmentedControl label="Mode" options={make()} value="c" onChange={vi.fn()} />);
    expect(track.scrollLeft).toBe(7);
  });

  it('with a value that matches no option, the first option is the tab stop', () => {
    render(<SegmentedControl label="Mode" options={options} value={'zzz' as 'a'} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Bravo' })).toHaveAttribute('tabindex', '-1');
  });
});
