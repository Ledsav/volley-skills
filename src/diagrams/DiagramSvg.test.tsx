import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DiagramSvg } from './DiagramSvg';
import { createItem, emptyScene } from './sceneFactory';
import type { Scene } from '../types/diagram';

const withItems = (items: Scene['items']): Scene => ({ ...emptyScene('full'), items });

describe('DiagramSvg', () => {
  it('renders an svg with a 0 0 100 100 viewBox and the court backdrop', () => {
    const { container } = render(<DiagramSvg scene={emptyScene('half')} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
    expect(container.querySelector('[data-court="half"]')).not.toBeNull();
  });

  it('renders items in array order (later items appear after earlier in the DOM)', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('ball', { x: 30, y: 30 }), id: 'b' };
    const { container } = render(<DiagramSvg scene={withItems([a, b])} />);
    const ids = [...container.querySelectorAll('[data-item-id]')].map((el) => el.getAttribute('data-item-id'));
    expect(ids).toEqual(['a', 'b']);
  });

  it('shows no selection outline when not interactive', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const { container } = render(<DiagramSvg scene={withItems([a])} selectedId="a" />);
    expect(container.querySelector('[data-selection-outline]')).toBeNull();
  });

  it('shows exactly one selection outline for the selected item when interactive', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('player', { x: 40, y: 40 }), id: 'b' };
    const { container } = render(<DiagramSvg scene={withItems([a, b])} interactive selectedId="a" />);
    expect(container.querySelectorAll('[data-selection-outline]')).toHaveLength(1);
  });

  it('calls onItemPointerDown with the item id when an item is pressed', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const onItemPointerDown = vi.fn();
    const { container } = render(
      <DiagramSvg scene={withItems([a])} interactive onItemPointerDown={onItemPointerDown} />,
    );
    fireEvent.pointerDown(container.querySelector('[data-item-id="a"]')!);
    expect(onItemPointerDown).toHaveBeenCalledWith('a', expect.anything());
  });

  it('renders endpoint handles for a selected arrow', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const { container } = render(<DiagramSvg scene={withItems([arrow])} interactive selectedId="ar" />);
    expect(container.querySelectorAll('[data-endpoint-handle]')).toHaveLength(2);
  });
});
