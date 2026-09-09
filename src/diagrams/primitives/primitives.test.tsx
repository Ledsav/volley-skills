import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CourtBackdrop } from './CourtBackdrop';
import { renderItem } from './index';
import { createItem } from '../sceneFactory';
import type {
  ArrowItem,
  BallItem,
  ConeItem,
  CourtPreset,
  DiagramItemType,
  LineItem,
  PlayerItem,
  PlayerView,
} from '../../types/diagram';

const svg = (child: React.ReactNode) => render(<svg viewBox="0 0 100 100">{child}</svg>).container;

const ALL_TYPES: DiagramItemType[] = ['player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel'];

describe('primitives', () => {
  it('renders one of every item type without throwing, tagged with data-item-*', () => {
    for (const type of ALL_TYPES) {
      const item = createItem(type, { x: 40, y: 50 });
      const container = svg(renderItem(item));
      const el = container.querySelector(`[data-item-id="${item.id}"]`);
      expect(el, `${type} must render a tagged element`).not.toBeNull();
      expect(el?.getAttribute('data-item-type')).toBe(type);
    }
  });

  it('renders each court preset; full/half draw a net line, blank draws nothing', () => {
    for (const court of ['full', 'half'] as CourtPreset[]) {
      const container = svg(<CourtBackdrop court={court} showZones={false} />);
      expect(container.querySelector('[data-court-net]')).not.toBeNull();
    }
    const blank = svg(<CourtBackdrop court="blank" showZones={false} />);
    expect(blank.querySelector('[data-court-net]')).toBeNull();
    expect(blank.querySelector('[data-court="blank"]')).not.toBeNull();
  });

  it('adds six zone labels when showZones is true', () => {
    const container = svg(<CourtBackdrop court="full" showZones />);
    expect(container.querySelectorAll('[data-zone-label]')).toHaveLength(6);
  });
});

const player = (patch: Partial<PlayerItem>): PlayerItem => ({
  ...(createItem('player', { x: 40, y: 50 }) as PlayerItem),
  ...patch,
});

describe('PlayerToken views', () => {
  const humanViews: PlayerView[] = ['above', 'aboveMale', 'aboveFemale', 'front', 'dig', 'spike', 'set'];

  it('tags the group with the active view', () => {
    for (const view of ['token', ...humanViews] as PlayerView[]) {
      const container = svg(renderItem(player({ view })));
      expect(container.querySelector(`[data-player-view="${view}"]`)).not.toBeNull();
    }
  });

  it('token view still draws a single disc plus the role label', () => {
    const container = svg(renderItem(player({ view: 'token', shape: 'circle', label: 'S' })));
    expect(container.querySelectorAll('circle')).toHaveLength(1);
    expect(container.textContent).toContain('S');
  });

  it('each human view draws a multi-part figure, not a bare disc', () => {
    for (const view of humanViews) {
      const container = svg(renderItem(player({ view })));
      const shapes = container.querySelectorAll('circle, ellipse, path, rect, polygon');
      expect(shapes.length, `${view} should be built from several shapes`).toBeGreaterThan(2);
    }
  });

  it('shows the role label under a human figure', () => {
    const container = svg(renderItem(player({ view: 'spike', label: 'OH' })));
    expect(container.textContent).toContain('OH');
  });

  it('puts a background behind the role label only when there is a label', () => {
    const labelled = svg(renderItem(player({ view: 'front', label: 'S' })));
    const bare = svg(renderItem(player({ view: 'front', label: '' })));
    expect(labelled.querySelectorAll('rect').length).toBeGreaterThan(
      bare.querySelectorAll('rect').length,
    );
  });
});

describe('Ball styles', () => {
  const ball = (patch: Partial<BallItem>): BallItem => ({
    ...(createItem('ball', { x: 40, y: 50 }) as BallItem),
    ...patch,
  });

  it('plain style draws a simple disc', () => {
    const container = svg(renderItem(ball({ style: 'plain' })));
    expect(container.querySelector('[data-ball-style="plain"]')).not.toBeNull();
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(1);
  });

  it('mikasa style draws panelled paths tinted by the item colour', () => {
    const container = svg(renderItem(ball({ style: 'mikasa', color: 'blue' })));
    expect(container.querySelector('[data-ball-style="mikasa"]')).not.toBeNull();
    const paths = container.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const tinted = Array.from(container.querySelectorAll('*')).some((el) =>
      (el.getAttribute('fill') ?? '').includes('--color-blue'),
    );
    expect(tinted).toBe(true);
  });
});

describe('Cone', () => {
  it('draws a body plus two reflective bands', () => {
    const cone: ConeItem = { ...(createItem('cone', { x: 40, y: 50 }) as ConeItem) };
    const container = svg(renderItem(cone));
    expect(container.querySelectorAll('[data-cone-band]')).toHaveLength(2);
  });
});

describe('Line / Arrow width follows the size control', () => {
  const line = (patch: Partial<LineItem>): LineItem => ({
    ...(createItem('line', { x: 10, y: 10 }) as LineItem),
    ...patch,
  });
  const arrow = (patch: Partial<ArrowItem>): ArrowItem => ({
    ...(createItem('arrow', { x: 10, y: 10 }) as ArrowItem),
    ...patch,
  });

  it('line stroke width is thickness times size', () => {
    const container = svg(renderItem(line({ thickness: 2, size: 1.5 })));
    expect(container.querySelector('path')?.getAttribute('stroke-width')).toBe('3');
  });

  it('arrow stroke width scales a shot by size', () => {
    const wide = svg(renderItem(arrow({ style: 'shot', size: 2 })));
    expect(wide.querySelector('path')?.getAttribute('stroke-width')).toBe('3.2');
    const thin = svg(renderItem(arrow({ style: 'pass', size: 0.5 })));
    expect(thin.querySelector('path')?.getAttribute('stroke-width')).toBe('0.5');
  });
});
