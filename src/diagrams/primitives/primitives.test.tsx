import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CourtBackdrop } from './CourtBackdrop';
import { renderItem } from './index';
import { createItem } from '../sceneFactory';
import type { CourtPreset, DiagramItemType } from '../../types/diagram';

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
