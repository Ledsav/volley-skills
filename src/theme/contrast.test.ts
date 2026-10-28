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
type RGB = [number, number, number];

const LEVEL_HUE: Record<Level, string> = {
  Beginner: 'red',
  Developing: 'orange',
  Advanced: 'blue',
  Elite: 'green',
};
const TINT_ALPHA = { light: 0.14, dark: 0.22 };

describe('design-token contrast (WCAG AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    const surface = token(theme, 'surface');
    const bg = token(theme, 'bg');
    it(`${theme}: ink-2 reads on surface and on bg`, () => {
      expect(contrast(token(theme, 'ink-2'), surface)).toBeGreaterThanOrEqual(AA);
      expect(contrast(token(theme, 'ink-2'), bg)).toBeGreaterThanOrEqual(AA);
    });
    it(`${theme}: on-ink reads on ink`, () => {
      expect(contrast(token(theme, 'on-ink'), token(theme, 'ink'))).toBeGreaterThanOrEqual(AA);
    });
    for (const hue of ['red', 'orange', 'blue', 'green']) {
      it(`${theme}: ${hue}-strong text reads on surface`, () => {
        expect(contrast(token(theme, `${hue}-strong`), surface)).toBeGreaterThanOrEqual(AA);
      });
    }
    for (const level of Object.keys(LEVEL_HUE) as Level[]) {
      it(`${theme}: ${level} pill text reads on its tint`, () => {
        const hue = LEVEL_HUE[level];
        const textClass = levelPillClass(level).split(' ').find((c) => /^text-\w+-strong$/.test(c));
        expect(textClass).toBe(`text-${hue}-strong`);
        const text = token(theme, textClass!.replace(/^text-/, ''));
        const bgTint = tint(token(theme, hue), TINT_ALPHA[theme], surface);
        expect(contrast(text, bgTint)).toBeGreaterThanOrEqual(AA);
      });
    }
    it(`${theme}: white text reads on an orange-strong badge`, () => {
      if (theme === 'dark') return; // badges keep white text only in light mode
      expect(contrast([255, 255, 255], token(theme, 'orange-strong'))).toBeGreaterThanOrEqual(AA);
    });
  }
});

describe('v2 chrome tokens (design system 2.1)', () => {
  const expected: Record<string, [RGB, RGB]> = {
    bg: [[245, 245, 247], [0, 0, 0]],
    surface: [[255, 255, 255], [28, 28, 30]],
    'surface-2': [[242, 242, 247], [44, 44, 46]],
    'surface-3': [[229, 229, 234], [58, 58, 60]],
    ink: [[29, 29, 31], [245, 245, 247]],
    'ink-2': [[110, 110, 115], [161, 161, 166]],
    'ink-3': [[142, 142, 147], [110, 110, 115]],
    'on-ink': [[255, 255, 255], [0, 0, 0]],
    separator: [[222, 222, 224], [55, 55, 58]],
    focus: [[0, 113, 227], [64, 156, 255]],
    sidebar: [[255, 255, 255], [13, 13, 15]],
  };
  it.each(Object.keys(expected))('%s has the spec value in both themes', (name) => {
    expect(token('light', name)).toEqual(expected[name][0]);
    expect(token('dark', name)).toEqual(expected[name][1]);
  });
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
