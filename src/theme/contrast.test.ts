import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { levelPillClass } from '../components/LevelPill';
import type { Level } from '../types/player';

// Vitest stubs CSS imports (even ?raw), so read the stylesheet from disk.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** Reads `--color-<name>: r g b;` from the light (`:root`) or dark (`.dark`) block of index.css. */
function token(theme: 'light' | 'dark', name: string): [number, number, number] {
  const start = theme === 'light' ? css.indexOf(':root {') : css.indexOf('.dark {');
  const block = css.slice(start, css.indexOf('}', start));
  const match = block.match(new RegExp(`--color-${name}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!match) throw new Error(`token ${name} missing in ${theme}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** `color` at `alpha` over `base`, like Tailwind's `bg-orange/10`. */
function tint(color: [number, number, number], alpha: number, base: [number, number, number]): [number, number, number] {
  return [0, 1, 2].map((i) => Math.round(color[i] * alpha + base[i] * (1 - alpha))) as [number, number, number];
}

const AA = 4.5;

describe('design-token contrast (WCAG AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    const surface = token(theme, 'surface');
    for (const hue of ['red', 'orange', 'blue', 'green']) {
      it(`${theme}: ${hue}-strong text reads on surface and on its /10 tint`, () => {
        const text = token(theme, `${hue}-strong`);
        expect(contrast(text, surface)).toBeGreaterThanOrEqual(AA);
        expect(contrast(text, tint(token(theme, hue), 0.1, surface))).toBeGreaterThanOrEqual(AA);
      });
    }
    it(`${theme}: white text reads on an orange-strong badge`, () => {
      if (theme === 'dark') return; // badges keep white text only in light mode
      expect(contrast([255, 255, 255], token(theme, 'orange-strong'))).toBeGreaterThanOrEqual(AA);
    });
  }
});

describe('level pills use the readable -strong text tokens', () => {
  it.each<[Level, string]>([
    ['Beginner', 'text-red-strong'],
    ['Developing', 'text-orange-strong'],
    ['Advanced', 'text-blue-strong'],
    ['Elite', 'text-green-strong'],
  ])('%s', (level, cls) => {
    expect(levelPillClass(level).split(' ')).toContain(cls);
  });
});
