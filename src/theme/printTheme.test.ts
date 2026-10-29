import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Declarations of a block's body, from the `{` at `open` to its matching `}`. */
function body(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unclosed block');
}

function declarations(block: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[\w-]+|color-scheme)\s*:\s*([^;]+);/g)) out.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  return out;
}

function topLevel(selector: RegExp): Map<string, string> {
  const m = selector.exec(css);
  if (!m) throw new Error(`no ${selector}`);
  return declarations(body(css, m.index + m[0].length - 1));
}

describe('print theme', () => {
  it('print resets every dark token to its light value', () => {
    const light = topLevel(/^:root\s*\{/m);
    const dark = topLevel(/^\.dark\s*\{/m);
    const printAt = css.search(/@media print\s*\{/);
    expect(printAt).toBeGreaterThanOrEqual(0);
    const print = body(css, css.indexOf('{', printAt));
    const darkAt = print.search(/\.dark\s*\{/);
    expect(darkAt).toBeGreaterThanOrEqual(0);
    const printDark = declarations(body(print, print.indexOf('{', darkAt)));

    expect(printDark.get('color-scheme')).toBe('light');
    for (const name of dark.keys()) {
      if (name === 'color-scheme') continue;
      expect(light.has(name), `${name} has a light value`).toBe(true);
      expect(printDark.get(name), name).toBe(light.get(name));
    }
  });
});
