import { describe, expect, it } from 'vitest';
import { createItem, emptyScene, newId } from './sceneFactory';
import { parseScene } from './parseScene';
import type { DiagramItemType } from '../types/diagram';

const ALL_TYPES: DiagramItemType[] = ['player', 'ball', 'cone', 'ladder', 'net', 'pole', 'line', 'arrow', 'text', 'zoneLabel'];

describe('sceneFactory', () => {
  it('emptyScene defaults to a full court with no items', () => {
    expect(emptyScene()).toEqual({ v: 1, court: 'full', showZones: false, items: [] });
    expect(emptyScene('blank').court).toBe('blank');
  });

  it('newId returns an 8-char string, unique across calls', () => {
    const a = newId();
    const b = newId();
    expect(a).toHaveLength(8);
    expect(a).not.toBe(b);
  });

  it('createItem builds a schema-valid item of every type at the given point', () => {
    for (const type of ALL_TYPES) {
      const item = createItem(type, { x: 40, y: 60 });
      expect(item.type).toBe(type);
      const result = parseScene({ v: 1, court: 'full', showZones: false, items: [item] });
      expect(result.ok, `type ${type} must survive parseScene`).toBe(true);
      if (result.ok) expect(result.scene.items[0]).toEqual(item);
    }
  });

  it('positions line and arrow endpoints relative to the drop point', () => {
    const line = createItem('line', { x: 30, y: 30 });
    if (line.type === 'line') expect(line.points[0]).toEqual({ x: 30, y: 30 });
    const arrow = createItem('arrow', { x: 30, y: 30 });
    if (arrow.type === 'arrow') expect(arrow.from).toEqual({ x: 30, y: 30 });
  });
});
