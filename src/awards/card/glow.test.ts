import { describe, expect, it } from 'vitest';
import { drawGlow, glowAlphaFor, hexAlpha } from './glow';
import { contrast, PRESET_PALETTES, slideColors, type Palette } from '../palette';
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

describe('glowAlphaFor', () => {
  const night = PRESET_PALETTES[0];
  const forSlide = (p: Palette, i: number) => slideColors(p, i);
  const ratio = (c: { bg: string; accent: string; text: string }, a: number) => {
    const ch = (h: string, k: number) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16);
    const m = (x: string, y: string, t: number) => '#' + [0, 1, 2].map((k) => Math.round(ch(x, k) * (1 - t) + ch(y, k) * t).toString(16).padStart(2, '0')).join('');
    return contrast(m(m(c.bg, c.accent, 0.22), c.accent, a), c.text);
  };

  it('keeps the card glow on Night and Navy within 3:1, as strong as it can be', () => {
    for (const id of ['night', 'navy']) {
      const p = PRESET_PALETTES.find((x) => x.id === id) ?? night;
      for (let i = 0; i < p.colors.length; i++) {
        const c = forSlide(p, i);
        const a = glowAlphaFor(c.bg, c.accent, c.text, 0.42);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(0.42);
        if (a > 0) expect(ratio(c, a)).toBeGreaterThanOrEqual(3);
        if (a > 0 && a < 0.42) expect(ratio(c, a + 0.02)).toBeLessThan(3);
      }
    }
  });

  it('gives Night a visible glow on its first slide', () => {
    const c = forSlide(night, 0);
    expect(glowAlphaFor(c.bg, c.accent, c.text, 0.42)).toBeGreaterThan(0.1);
  });

  it('fades the glow behind the label on a light custom palette instead of dropping it all-or-nothing', () => {
    const light: Palette = { id: 'custom-x', name: 'Pale', colors: ['#F2F2F7', '#E5E5EA', '#FFE9A8', '#D6F0FF'] };
    for (let i = 0; i < light.colors.length; i++) {
      const c = forSlide(light, i);
      const a = glowAlphaFor(c.bg, c.accent, c.text, 0.42);
      if (a > 0) expect(ratio(c, a)).toBeGreaterThanOrEqual(3);
    }
    expect(glowAlphaFor('#6B6B6B', '#FFFFFF', '#FFFFFF', 0.42)).toBeLessThan(0.42);
  });
});
