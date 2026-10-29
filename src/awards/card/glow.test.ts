import { describe, expect, it } from 'vitest';
import { drawGlow, hexAlpha } from './glow';
import { recordingCtx } from './testCtx';

describe('glow', () => {
  it('hexAlpha appends the alpha byte', () => {
    expect(hexAlpha('#F97316', 0.4)).toBe('#F9731666');
    expect(hexAlpha('#F97316', 2)).toBe('#F97316FF');
    expect(hexAlpha('#F97316', -1)).toBe('#F9731600');
  });

  it('drawGlow paints a radial gradient and skips a zero alpha', () => {
    const a = recordingCtx();
    drawGlow(a.ctx, 100, 200, 50, '#F97316', 0.3);
    expect(a.calls.find((c) => c.method === 'createRadialGradient')!.args).toEqual([100, 200, 0, 100, 200, 50]);
    expect(a.calls.find((c) => c.method === 'fillRect')!.args).toEqual([50, 150, 100, 100]);
    const b = recordingCtx();
    drawGlow(b.ctx, 100, 200, 50, '#F97316', 0);
    expect(b.calls).toHaveLength(0);
  });
});

describe('readableOverGlow', () => {
  it('keeps the glow behind labels on dark palettes and drops it on a light one where the label would wash out', async () => {
    const { readableOverGlow } = await import('./glow');
    expect(readableOverGlow('#0A1F44', '#F97316', '#FFFFFF', 0.42)).toBe(true);
    // mid-grey background with white text, a pale accent glow lifts the background under 4.5
    expect(readableOverGlow('#6B6B6B', '#FFFFFF', '#FFFFFF', 0.42)).toBe(false);
  });
});
