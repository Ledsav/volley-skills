import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OG, ogImageSvg, pngSize } from './ogImage.mjs';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p));
const text = (p) => read(p).toString('utf8');
const lockup = text('docs/design/brand/logo/volley-skills-lockup-white.svg');
const count = (s, re) => (s.match(re) ?? []).length;

describe('ogImageSvg', () => {
  it('centres the white lockup on black at 1200×630', () => {
    const svg = ogImageSvg(lockup);
    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('viewBox="0 0 946 256"');
    expect(svg).toContain('x="240"');
    expect(count(svg, /<path/g)).toBe(count(lockup, /<path/g));
    expect(count(svg, /<title/g)).toBeLessThanOrEqual(1);
    expect(OG.lockupWidth).toBe(720);
  });
});

describe('pngSize', () => {
  it('reads the IHDR and rejects a non-PNG', () => {
    expect(pngSize(read('public/icon-192.png'))).toEqual({ width: 192, height: 192 });
    expect(() => pngSize(Buffer.from('not a png at all, not even close'))).toThrow();
  });
});

describe('public web assets', () => {
  it('every manifest icon exists at its declared size', () => {
    const manifest = JSON.parse(text('public/manifest.webmanifest'));
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(read(`public${icon.src}`)), icon.src).toEqual({ width: w, height: h });
    }
    expect(manifest.icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
    expect(manifest.theme_color).toBe('#000000');
  });

  it('public web icons are the brand kit files', () => {
    const kit = 'docs/design/brand/logo/web-icons/';
    const pairs = [
      ['favicon.svg', 'favicon.svg'],
      ['favicon.ico', 'favicon.ico'],
      ['apple-touch-icon.png', 'apple-touch-icon.png'],
      ['icon-192.png', 'icon-192.png'],
      ['icon-512.png', 'icon-512.png'],
      ['maskable-512.png', 'icon-maskable-512.png'],
    ];
    for (const [from, to] of pairs) expect(read(`public/${to}`).equals(read(kit + from)), to).toBe(true);
  });

  it('every icon and manifest link in index.html resolves to a file in public', () => {
    const html = text('index.html');
    const links = [...html.matchAll(/<link\b[^>]*>/g)]
      .map((m) => m[0])
      .filter((l) => /rel="(icon|apple-touch-icon|manifest)"/.test(l));
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const l of links) {
      const href = /href="([^"]+)"/.exec(l)[1];
      expect(() => read(`public${href}`), href).not.toThrow();
    }
  });

  it('the OG image is 1200×630', () => {
    expect(pngSize(read('public/og-image.png'))).toEqual({ width: 1200, height: 630 });
  });
});
