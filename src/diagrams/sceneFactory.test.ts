import { describe, expect, it } from 'vitest';
import { cloneItemAt, createItem, emptyScene, newId } from './sceneFactory';
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

  it('defaults a new player to the top-down human view and a new ball to plain', () => {
    const player = createItem('player', { x: 40, y: 60 });
    if (player.type === 'player') expect(player.view).toBe('above');
    const ball = createItem('ball', { x: 40, y: 60 });
    if (ball.type === 'ball') expect(ball.style).toBe('plain');
  });

  it('positions line and arrow endpoints relative to the drop point', () => {
    const line = createItem('line', { x: 30, y: 30 });
    if (line.type === 'line') expect(line.points[0]).toEqual({ x: 30, y: 30 });
    const arrow = createItem('arrow', { x: 30, y: 30 });
    if (arrow.type === 'arrow') expect(arrow.from).toEqual({ x: 30, y: 30 });
  });
});

describe('cloneItemAt', () => {
  it('clones a point item with a fresh id, offset position, all else equal', () => {
    const player = createItem('player', { x: 40, y: 60 });
    const clone = cloneItemAt(player, 2.5, 2.5);

    expect(clone.id).not.toBe(player.id);
    expect(clone.id).toHaveLength(8);
    expect(clone.x).toBe(42.5);
    expect(clone.y).toBe(62.5);
    // Everything but id/x/y is unchanged.
    expect({ ...clone, id: player.id, x: player.x, y: player.y }).toEqual(player);

    const result = parseScene({ v: 1, court: 'full', showZones: false, items: [clone] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene.items[0]).toEqual(clone);
  });

  it('offsets every point of a line and gives it a fresh id', () => {
    const line = createItem('line', { x: 30, y: 30 });
    const clone = cloneItemAt(line, 5, -3);

    expect(clone.id).not.toBe(line.id);
    if (line.type === 'line' && clone.type === 'line') {
      expect(clone.points).toEqual(line.points.map((p) => ({ x: p.x + 5, y: p.y - 3 })));
    } else {
      throw new Error('expected line items');
    }

    const result = parseScene({ v: 1, court: 'full', showZones: false, items: [clone] });
    expect(result.ok).toBe(true);
  });

  it('offsets both endpoints of an arrow and gives it a fresh id', () => {
    const arrow = createItem('arrow', { x: 30, y: 30 });
    const clone = cloneItemAt(arrow, 4, 4);

    expect(clone.id).not.toBe(arrow.id);
    if (arrow.type === 'arrow' && clone.type === 'arrow') {
      expect(clone.from).toEqual({ x: arrow.from.x + 4, y: arrow.from.y + 4 });
      expect(clone.to).toEqual({ x: arrow.to.x + 4, y: arrow.to.y + 4 });
    } else {
      throw new Error('expected arrow items');
    }

    const result = parseScene({ v: 1, court: 'full', showZones: false, items: [clone] });
    expect(result.ok).toBe(true);
  });

  it('is deep-independent: mutating the clone never reaches the original', () => {
    const line = createItem('line', { x: 20, y: 20 });
    const lineClone = cloneItemAt(line, 1, 1);
    if (line.type === 'line' && lineClone.type === 'line') {
      lineClone.points[0].x = 999;
      lineClone.points.push({ x: 1, y: 2 });
      expect(line.points[0].x).not.toBe(999);
      expect(line.points).toHaveLength(2);
    }

    const arrow = createItem('arrow', { x: 20, y: 20 });
    const arrowClone = cloneItemAt(arrow, 1, 1);
    if (arrow.type === 'arrow' && arrowClone.type === 'arrow') {
      arrowClone.from.x = 999;
      arrowClone.to.y = -999;
      expect(arrow.from.x).not.toBe(999);
      expect(arrow.to.y).not.toBe(-999);
    }
  });
});
