import { describe, expect, it } from 'vitest';
import { computeHandleTransform, normalizeDeg } from './transformMath';

describe('normalizeDeg', () => {
  it('wraps angles into (-180, 180]', () => {
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-270)).toBe(90);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(540)).toBe(180);
  });
});

describe('computeHandleTransform', () => {
  const center = { x: 50, y: 50 };
  const base = { center, startRotation: 0, snapRotation: false } as const;

  it('scales size with the distance ratio and clamps at 2', () => {
    // start radius 10, current radius 20 → 2x
    const doubled = computeHandleTransform({
      ...base,
      start: { x: 60, y: 50 },
      current: { x: 70, y: 50 },
      startSize: 0.75,
    });
    expect(doubled.size).toBeCloseTo(1.5, 6);

    const clamped = computeHandleTransform({
      ...base,
      start: { x: 60, y: 50 },
      current: { x: 70, y: 50 },
      startSize: 1.5,
    });
    expect(clamped.size).toBe(2);
  });

  it('floors size at 0.5 when the handle is pulled toward the centre', () => {
    // start radius 20, current radius 10 → 0.5x
    const half = computeHandleTransform({
      ...base,
      start: { x: 70, y: 50 },
      current: { x: 60, y: 50 },
      startSize: 1,
    });
    expect(half.size).toBe(0.5);

    const floored = computeHandleTransform({
      ...base,
      start: { x: 70, y: 50 },
      current: { x: 55, y: 50 },
      startSize: 0.6,
    });
    expect(floored.size).toBe(0.5);
  });

  it('adds a +90 degree pointer sweep to the rotation', () => {
    const r = computeHandleTransform({
      center,
      start: { x: 60, y: 50 }, // angle 0
      current: { x: 50, y: 60 }, // angle +90 (y points down)
      startSize: 1,
      startRotation: 20,
      snapRotation: false,
    });
    expect(r.rotation).toBeCloseTo(110, 6);
  });

  it('snaps a 37 degree result to the nearest 15 (30) when snapRotation is set', () => {
    const rad = (37 * Math.PI) / 180;
    const r = computeHandleTransform({
      center,
      start: { x: 60, y: 50 },
      current: { x: 50 + 10 * Math.cos(rad), y: 50 + 10 * Math.sin(rad) },
      startSize: 1,
      startRotation: 0,
      snapRotation: true,
    });
    expect(r.rotation).toBe(30);
  });

  it('does not divide by zero / produce NaN when the drag starts at the centre', () => {
    const r = computeHandleTransform({
      center,
      start: { x: 50, y: 50 },
      current: { x: 60, y: 50 },
      startSize: 1,
      startRotation: 0,
      snapRotation: false,
    });
    expect(Number.isNaN(r.size)).toBe(false);
    expect(Number.isNaN(r.rotation)).toBe(false);
    expect(r.size).toBeGreaterThan(0);
  });
});
