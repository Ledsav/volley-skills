import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PALETTE_COLORS } from '../../types/diagram';
import { createItem, emptyScene } from '../../diagrams/sceneFactory';
import { diagramToPdfSvg, LIGHT_TOKENS, resolveThemeColors } from './diagramToPdfSvg';

describe('resolveThemeColors', () => {
  it('replaces a theme colour with its light rgb value', () => {
    expect(resolveThemeColors('fill="rgb(var(--color-ink))"')).toBe('fill="rgb(29,29,31)"');
  });

  it('turns a colour with alpha into rgba', () => {
    expect(resolveThemeColors('rgb(var(--color-blue) / 0.1)')).toBe('rgba(0,122,255,0.1)');
  });

  it('falls back to ink for an unknown token', () => {
    expect(resolveThemeColors('rgb(var(--color-nope))')).toBe('rgb(29,29,31)');
  });

  it('every inlined colour matches the light theme in index.css', () => {
    const css = readFileSync(fileURLToPath(new URL('../../index.css', import.meta.url)), 'utf8');
    const start = css.indexOf(':root {');
    const root = css.slice(start, css.indexOf('
}', start));
    const parsed = new Map<string, number[]>();
    for (const m of root.matchAll(/--color-([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) parsed.set(m[1], [+m[2], +m[3], +m[4]]);
    for (const [key, rgb] of Object.entries(LIGHT_TOKENS)) expect(parsed.get(key), key).toEqual(rgb);
  });

  it('covers every colour a diagram can draw', () => {
    for (const c of [...PALETTE_COLORS, 'surface']) expect(Object.keys(LIGHT_TOKENS)).toContain(c);
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
  it('crops a half court to the court instead of a mostly empty square', () => {
    const svg = diagramToPdfSvg(emptyScene('half'));
    expect(svg).toContain('viewBox="0 0 100 78"');
    expect(svg).toContain('height="78"');
  });

  it('keeps items placed below a half court inside the crop', () => {
    const scene = emptyScene('half');
    scene.items = [createItem('player', { x: 50, y: 90 })];
    const height = Number(/viewBox="0 0 100 ([\d.]+)"/.exec(diagramToPdfSvg(scene))?.[1]);
    expect(height).toBeGreaterThan(90);
    expect(height).toBeLessThanOrEqual(100);
  });

  it('keeps a full court square', () => {
    expect(diagramToPdfSvg(emptyScene('full'))).toContain('viewBox="0 0 100 100"');
  });
});
