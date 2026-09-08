import { describe, expect, it } from 'vitest';
import { parseScene } from './parseScene';
import type { Scene } from '../types/diagram';

const player = { id: 'p1', type: 'player', x: 20, y: 30, rotation: 0, size: 1, color: 'blue', label: 'S', shape: 'circle' };
const scene = (items: unknown[]): unknown => ({ v: 1, court: 'full', showZones: false, items });

describe('parseScene', () => {
  it('round-trips a valid scene unchanged', () => {
    const input = scene([player]);
    const result = parseScene(input);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scene).toEqual(input);
  });

  it('rejects a non-object, wrong version, bad court, or non-array items', () => {
    expect(parseScene(null).ok).toBe(false);
    expect(parseScene('x').ok).toBe(false);
    expect(parseScene({ ...(scene([]) as object), v: 2 }).ok).toBe(false);
    expect(parseScene({ ...(scene([]) as object), court: 'oval' }).ok).toBe(false);
    expect(parseScene({ v: 1, court: 'full', showZones: false, items: {} }).ok).toBe(false);
  });

  it('rejects a scene with more than 60 items', () => {
    const items = Array.from({ length: 61 }, (_, i) => ({ ...player, id: `p${i}` }));
    expect(parseScene(scene(items)).ok).toBe(false);
  });

  it('drops items with an unknown type but keeps the rest', () => {
    const result = parseScene(scene([player, { id: 'x', type: 'hologram', x: 0, y: 0 }]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scene.items).toHaveLength(1);
      expect(result.scene.items[0].id).toBe('p1');
    }
  });

  it('clamps out-of-range numbers and truncates over-long strings', () => {
    const result = parseScene(
      scene([{ ...player, x: 999, size: 9, rotation: 900, label: 'LONGLABEL' }])
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const it = result.scene.items[0] as Extract<Scene['items'][number], { type: 'player' }>;
      expect(it.x).toBe(120);
      expect(it.size).toBe(2);
      expect(it.rotation).toBe(180);
      expect(it.label).toBe('LON');
    }
  });

  it('coerces an unknown colour to ink', () => {
    const result = parseScene(scene([{ ...player, color: 'gold' }]));
    if (result.ok) expect(result.scene.items[0].color).toBe('ink');
    else throw new Error('expected ok');
  });

  it('rejects an item missing a required type-specific field', () => {
    expect(parseScene(scene([{ id: 'l1', type: 'ladder', x: 0, y: 0, rotation: 0, size: 1, color: 'ink' }])).ok).toBe(false);
    expect(parseScene(scene([{ id: 'a1', type: 'arrow', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', from: { x: 0, y: 0 } }])).ok).toBe(false);
    expect(parseScene(scene([{ id: 'n1', type: 'net', x: 0, y: 0, rotation: 0, size: 1, color: 'ink' }])).ok).toBe(false);
    expect(parseScene(scene([{ id: 'z1', type: 'zoneLabel', x: 0, y: 0, rotation: 0, size: 1, color: 'ink' }])).ok).toBe(false);
  });

  it('clamps line.points to the first 12 and rejects fewer than 2', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i }));
    const ok = parseScene(scene([{ id: 'l1', type: 'line', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', points: many, style: 'solid', thickness: 2 }]));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((ok.scene.items[0] as { points: unknown[] }).points).toHaveLength(12);
    const tooFew = parseScene(scene([{ id: 'l2', type: 'line', x: 0, y: 0, rotation: 0, size: 1, color: 'ink', points: [{ x: 0, y: 0 }], style: 'solid', thickness: 2 }]));
    expect(tooFew.ok).toBe(false);
  });

  it('defaults showZones to false and requires the field to be boolean when present', () => {
    const r1 = parseScene({ v: 1, court: 'blank', items: [] });
    expect(r1.ok && r1.scene.showZones).toBe(false);
  });
});
