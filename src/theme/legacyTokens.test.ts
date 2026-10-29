import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('legacy tokens are gone', () => {
  it('tailwind has no legacy colour or type roles', () => {
    const cfg = read('tailwind.config.js');
    expect(cfg).not.toMatch(/^\s*(navy|slate|border):/m);
    expect(cfg).not.toMatch(/^\s*(title|section):\s*\[/m);
    expect(cfg).not.toContain('removed in increment 6');
  });

  it('index.css keeps navy and blue for stored diagram colours but no slate or border', () => {
    const css = read('src/index.css');
    expect(css).not.toContain('--color-slate');
    expect(css).not.toContain('--color-border');
    const root = css.slice(css.indexOf(':root'), css.indexOf('.dark'));
    const dark = css.slice(css.indexOf('.dark'));
    for (const block of [root, dark]) {
      expect(block).toContain('--color-navy');
      expect(block).toContain('--color-blue');
    }
  });

  it('no source file uses a legacy token class', () => {
    const re =
      /(?:^|[\s"'`:])(?:text|bg|border|divide|ring|outline|fill|stroke)-(?:slate|border|navy)(?![\w-])|(?:^|[\s"'`:])text-(?:title|section)(?![\w-])|(?:ring|outline)-blue(?![\w-])/m;
    const files = (readdirSync('src', { recursive: true }) as string[])
      .map((f) => String(f).split('\\').join('/'))
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const bad = files.filter((f) => re.test(read(`src/${f}`)));
    expect(bad, `legacy token classes in: ${bad.join(', ')}`).toEqual([]);
  });
});
