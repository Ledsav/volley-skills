import { describe, expect, it } from 'vitest';
import { createItem, emptyScene } from '../../diagrams/sceneFactory';
import { diagramToPdfSvg, LIGHT_TOKENS, resolveThemeColors } from './diagramToPdfSvg';

describe('resolveThemeColors', () => {
  it('replaces a theme colour with its light rgb value', () => {
    expect(resolveThemeColors('fill="rgb(var(--color-ink))"')).toBe('fill="rgb(15,23,42)"');
  });

  it('turns a colour with alpha into rgba', () => {
    expect(resolveThemeColors('rgb(var(--color-blue) / 0.1)')).toBe('rgba(40,101,246,0.1)');
  });

  it('falls back to ink for an unknown token', () => {
    expect(resolveThemeColors('rgb(var(--color-nope))')).toBe('rgb(15,23,42)');
  });

  it('keeps ink in step with index.css', () => {
    expect(LIGHT_TOKENS.ink).toEqual([15, 23, 42]);
  });
});

describe('diagramToPdfSvg', () => {
  it('renders a standalone SVG with no CSS variables left', () => {
    const scene = emptyScene('full');
    scene.items = (['player', 'arrow', 'net', 'cone', 'ball'] as const).map((t, i) => createItem(t, { x: 20 + i * 10, y: 50 }));
    const svg = diagramToPdfSvg(scene);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('<marker');
    expect(svg).toContain('<pattern');
    expect(svg).toContain('width="100"');
    expect(svg).not.toContain('var(--');
  });
});
