import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest stubs CSS imports, so read the stylesheet from disk.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** The body of the first `@media (query) { ... }` block (brace-balanced). */
function mediaBlock(query: string): string {
  const start = css.indexOf(`@media (${query})`);
  if (start < 0) throw new Error(`@media (${query}) missing`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('unbalanced');
}

describe('system-setting media queries', () => {
  it('reduced transparency makes glass solid surface and drops the blur', () => {
    const block = mediaBlock('prefers-reduced-transparency: reduce');
    expect(block).toMatch(/\.glass\s*\{[^}]*--glass:\s*rgb\(var\(--color-surface\)\)/);
    expect(block).toMatch(/\.glass\s*\{[^}]*backdrop-filter:\s*none/);
  });

  it('more contrast overrides the separator in both themes', () => {
    const block = mediaBlock('prefers-contrast: more');
    expect(block).toMatch(/:root\s*\{[^}]*--color-separator:\s*198 198 200;/);
    expect(block).toMatch(/\.dark\s*\{[^}]*--color-separator:\s*56 56 58;/);
  });

  it('reduced motion turns the press scale off', () => {
    const block = mediaBlock('prefers-reduced-motion: reduce');
    expect(block).toMatch(/\.pressable:active\s*\{[^}]*transform:\s*none/);
  });
});
