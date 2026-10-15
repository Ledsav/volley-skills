// src/awards/cutout/segment.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const createFromOptions = vi.fn();
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn().mockResolvedValue({}) },
  ImageSegmenter: { createFromOptions: (...a: unknown[]) => createFromOptions(...a) },
}));

import { maskToAlpha, opaqueBounds, removeBackground } from './segment';

describe('segment', () => {
  afterEach(() => createFromOptions.mockReset());

  it('maps confidence to alpha with a soft edge', () => {
    const a = maskToAlpha(new Float32Array([0, 0.5, 1, 0.2]), 2, 2, 2, 2);
    expect([...a]).toEqual([0, 128, 255, 0]);
  });

  it('samples a smaller mask up to the image size (nearest)', () => {
    const a = maskToAlpha(new Float32Array([1, 0]), 2, 1, 4, 1);
    expect([...a]).toEqual([255, 255, 0, 0]);
  });

  it('finds the opaque bounding box, or null when empty', () => {
    const alpha = new Uint8ClampedArray([
      0, 0, 0, 0,
      0, 200, 200, 0,
      0, 0, 200, 0,
    ]);
    expect(opaqueBounds(alpha, 4, 3)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    expect(opaqueBounds(new Uint8ClampedArray(4), 2, 2)).toBeNull();
  });

  it('retry after load failure: rejects, then a later call loads again', async () => {
    createFromOptions.mockRejectedValueOnce(new Error('no wasm'));
    const photo = document.createElement('canvas');
    await expect(removeBackground(photo)).rejects.toThrow('no wasm');
    createFromOptions.mockRejectedValueOnce(new Error('still no'));
    await expect(removeBackground(photo)).rejects.toThrow('still no');
    expect(createFromOptions).toHaveBeenCalledTimes(2);
  });
});
