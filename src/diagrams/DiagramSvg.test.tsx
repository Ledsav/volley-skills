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
    const { container } = render(<DiagramSvg scene={withItems([a])} selectedIds={['a']} />);
    expect(container.querySelector('[data-selection-outline]')).toBeNull();
  });

  it('shows exactly one selection outline for the selected item when interactive', () => {
    const a = { ...createItem('player', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('player', { x: 40, y: 40 }), id: 'b' };
    const { container } = render(<DiagramSvg scene={withItems([a, b])} interactive selectedIds={['a']} />);
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
    const { container } = render(<DiagramSvg scene={withItems([arrow])} interactive selectedIds={['ar']} />);
    expect(container.querySelectorAll('[data-endpoint-handle]')).toHaveLength(2);
  });

  it('renders a transform handle for a selected point item and reports its pointerdown', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const onTransformHandlePointerDown = vi.fn();
    const onItemPointerDown = vi.fn();
    const onBackgroundPointerDown = vi.fn();
    const { container } = render(
      <DiagramSvg
        scene={withItems([a])}
        interactive
        selectedIds={['a']}
        onItemPointerDown={onItemPointerDown}
        onBackgroundPointerDown={onBackgroundPointerDown}
        onTransformHandlePointerDown={onTransformHandlePointerDown}
      />,
    );
    const handle = container.querySelector('[data-transform-handle]');
    expect(handle).not.toBeNull();

    fireEvent.pointerDown(handle!);
    expect(onTransformHandlePointerDown).toHaveBeenCalledWith('a', expect.anything());
    // stopPropagation: pressing the handle is not an item drag nor a background click.
    expect(onItemPointerDown).not.toHaveBeenCalled();
    expect(onBackgroundPointerDown).not.toHaveBeenCalled();
  });

  it('reports the endpoint index on pointerdown and stops propagation', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const onEndpointPointerDown = vi.fn();
    const onItemPointerDown = vi.fn();
    const onBackgroundPointerDown = vi.fn();
    const { container } = render(
      <DiagramSvg
        scene={withItems([arrow])}
        interactive
        selectedIds={['ar']}
        onItemPointerDown={onItemPointerDown}
        onBackgroundPointerDown={onBackgroundPointerDown}
        onEndpointPointerDown={onEndpointPointerDown}
      />,
    );
    const dot = container.querySelector('[data-endpoint-handle][data-endpoint-index="1"]')!;
    fireEvent.pointerDown(dot);
    expect(onEndpointPointerDown).toHaveBeenCalledWith('ar', 1, expect.anything());
    // stopPropagation: not an item drag nor a background click.
    expect(onItemPointerDown).not.toHaveBeenCalled();
    expect(onBackgroundPointerDown).not.toHaveBeenCalled();
  });

  it('leaves the endpoint dots decorative when onEndpointPointerDown is not passed', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const { container } = render(
      <DiagramSvg scene={withItems([arrow])} interactive selectedIds={['ar']} />,
    );
    const dots = container.querySelectorAll('[data-endpoint-handle]');
    expect(dots).toHaveLength(2);
    dots.forEach((d) => {
      expect((d as SVGElement).style.pointerEvents).not.toBe('auto');
      expect(d.parentElement?.getAttribute('style') ?? '').not.toContain('pointer-events: auto');
    });
  });

  it('does not render a transform handle for a selected line/arrow (endpoints only)', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const { container } = render(<DiagramSvg scene={withItems([arrow])} interactive selectedIds={['ar']} />);
    expect(container.querySelector('[data-transform-handle]')).toBeNull();
  });

  it('draws one outline per selected item and no single-select handles when >1 selected', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const b = { ...createItem('cone', { x: 40, y: 40 }), id: 'b' };
    const { container } = render(
      <DiagramSvg scene={withItems([a, b])} interactive selectedIds={['a', 'b']} />,
    );
    expect(container.querySelectorAll('[data-selection-outline]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-transform-handle]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-endpoint-handle]')).toHaveLength(0);
  });

  it('draws one outline + a transform handle for a single selected point item', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const { container } = render(
      <DiagramSvg scene={withItems([a])} interactive selectedIds={['a']} />,
    );
    expect(container.querySelectorAll('[data-selection-outline]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-transform-handle]')).toHaveLength(1);
  });

  it('draws one outline + two endpoint handles for a single selected arrow', () => {
    const arrow = { ...createItem('arrow', { x: 10, y: 10 }), id: 'ar' };
    const { container } = render(
      <DiagramSvg scene={withItems([arrow])} interactive selectedIds={['ar']} />,
    );
    expect(container.querySelectorAll('[data-selection-outline]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-endpoint-handle]')).toHaveLength(2);
  });

  it('renders no selection layer for an empty selection or a non-interactive svg', () => {
    const a = { ...createItem('cone', { x: 20, y: 20 }), id: 'a' };
    const empty = render(<DiagramSvg scene={withItems([a])} interactive selectedIds={[]} />);
    expect(empty.container.querySelector('[data-selection-outline]')).toBeNull();
    const inert = render(<DiagramSvg scene={withItems([a])} selectedIds={['a']} />);
    expect(inert.container.querySelector('[data-selection-outline]')).toBeNull();
  });
});
