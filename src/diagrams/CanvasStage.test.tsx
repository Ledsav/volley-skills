import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CanvasStage, startedOnItem, type StageApi } from './CanvasStage';

// NB: @use-gesture's native pointer pipeline (pointer capture + document-level
// listeners) is not reliably drivable with jsdom's synthetic events, so the pan
// guard is verified through its pure predicate `startedOnItem` — the exact value
// `onDrag` branches on — rather than a simulated drag. (fix-spec C1 fallback.)

describe('startedOnItem', () => {
  it('is true when the target is, or is inside, a diagram item', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<g data-item-id="x1"><circle></circle></g>';
    expect(startedOnItem(wrap.querySelector('g'))).toBe(true);
    expect(startedOnItem(wrap.querySelector('circle'))).toBe(true);
  });

  it('is true on an endpoint or transform selection handle', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<circle data-endpoint-handle></circle><rect data-transform-handle></rect>';
    expect(startedOnItem(wrap.querySelector('[data-endpoint-handle]'))).toBe(true);
    expect(startedOnItem(wrap.querySelector('[data-transform-handle]'))).toBe(true);
  });

  it('is false on the bare stage background and on a null target', () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = '<div data-canvas-stage><svg><rect data-court></rect></svg></div>';
    expect(startedOnItem(wrap.querySelector('[data-court]'))).toBe(false);
    expect(startedOnItem(wrap.querySelector('[data-canvas-stage]'))).toBe(false);
    expect(startedOnItem(null)).toBe(false);
  });
});

describe('CanvasStage', () => {
  it('renders the stage and an inner transform wrapper around its children', () => {
    const { container } = render(
      <CanvasStage>
        <svg>
          <g data-item-id="i1">
            <circle />
          </g>
        </svg>
      </CanvasStage>,
    );
    expect(container.querySelector('[data-canvas-stage]')).not.toBeNull();
    const wrap = container.querySelector('[data-canvas-transform]') as HTMLElement;
    expect(wrap).not.toBeNull();
    expect(wrap.querySelector('[data-item-id="i1"]')).not.toBeNull();
  });
});

describe('CanvasStage insets', () => {
  function renderStage() {
    let api: StageApi | null = null;
    const { container } = render(
      <CanvasStage onReady={(a) => (api = a)} insets={{ top: 100, right: 300, bottom: 0, left: 100 }}>
        <svg />
      </CanvasStage>,
    );
    const stage = container.querySelector('[data-canvas-stage]') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
    return () => api!;
  }

  it('fits the court into the stage minus the insets', () => {
    const api = renderStage();
    // Inner area 600 x 700 -> a 600 px square at (100, 150); its centre is (400, 450).
    expect(api().screenToCourt(400, 450)).toEqual({ x: 50, y: 50 });
    expect(api().screenToCourt(100, 150)).toEqual({ x: 0, y: 0 });
  });

  it('zooms around the centre of the court area and maps points through the zoom', () => {
    const api = renderStage();
    act(() => api().zoomBy(2));
    expect(api().screenToCourt(400, 450)).toEqual({ x: 50, y: 50 });
    // At 2x one court unit is 12 px, so 60 px right of the centre is 5 units.
    const p = api().screenToCourt(460, 450);
    expect(p.x).toBeCloseTo(55);
    expect(p.y).toBeCloseTo(50);
  });
});
