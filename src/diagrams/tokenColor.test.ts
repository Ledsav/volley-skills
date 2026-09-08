import { describe, expect, it } from 'vitest';
import { PALETTE_COLORS } from '../types/diagram';
import { tokenColor, tokenColorAlpha } from './tokenColor';

describe('tokenColor', () => {
  it('maps every palette colour to its CSS custom-property reference', () => {
    for (const name of PALETTE_COLORS) {
      expect(tokenColor(name)).toBe(`rgb(var(--color-${name}))`);
    }
  });

  it('falls back to ink for an unknown name', () => {
    expect(tokenColor('chartreuse')).toBe('rgb(var(--color-ink))');
  });

  it('produces an alpha form clamped to 0..1', () => {
    expect(tokenColorAlpha('ink', 0.4)).toBe('rgb(var(--color-ink) / 0.4)');
    expect(tokenColorAlpha('ink', 5)).toBe('rgb(var(--color-ink) / 1)');
    expect(tokenColorAlpha('ink', -1)).toBe('rgb(var(--color-ink) / 0)');
  });
});
