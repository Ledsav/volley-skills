import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The data colours (red, blue, orange, green) are fill hues: as text on a light surface they fall under
// WCAG AA. Text must use the `-strong` form, and a solid data-colour fill carrying text must use
// `bg-<c>-strong text-on-ink` (never white text on the fill hue).
const SRC = resolve(process.cwd(), 'src');
const TEXT = /(^|[\s"'`{:])text-(red|blue|orange|green)(?![-\w])/;
const FILL_WITH_WHITE = /\bbg-(red|blue|orange|green)(?![-/\w])[^"'`]*\btext-white\b|\btext-white\b[^"'`]*\bbg-(red|blue|orange|green)(?![-/\w])/;

function sources(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
    .map((f) => join(SRC, f));
}

describe('data colours as text', () => {
  it('no source uses text-red|blue|orange|green without -strong', () => {
    const found: string[] = [];
    for (const file of sources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (TEXT.test(line)) found.push(`${file.slice(SRC.length + 1)}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });

  it('no data-colour fill carries white text', () => {
    const found: string[] = [];
    for (const file of sources()) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (FILL_WITH_WHITE.test(line)) found.push(`${file.slice(SRC.length + 1)}:${i + 1}`);
        });
    }
    expect(found).toEqual([]);
  });
});
