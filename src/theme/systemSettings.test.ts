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

  it('pressable eases hover colour changes as well as the press scale', () => {
    expect(css).toMatch(/\.pressable\s*\{[^}]*transition:[^;}]*background-color/);
  });

  it('reduced motion turns the press scale off', () => {
    const block = mediaBlock('prefers-reduced-motion: reduce');
    expect(block).toMatch(/\.pressable:active\s*\{[^}]*transform:\s*none/);
  });

  it('phone type sizes: large-title 30/36 and score 56 below 768px, with tailwind roles reading the variables', () => {
    const block = mediaBlock('max-width: 767px');
    expect(block).toMatch(/:root\s*\{[^}]*--fs-large-title:\s*1\.875rem;[^}]*--lh-large-title:\s*2\.25rem;/);
    expect(block).toMatch(/--fs-score:\s*3\.5rem;/);
    expect(css).toMatch(/--fs-large-title:\s*2\.125rem;/);
    expect(css).toMatch(/--fs-score:\s*4\.5rem;/);
    const tw = readFileSync(resolve(process.cwd(), 'tailwind.config.js'), 'utf8');
    expect(tw).toMatch(/'large-title':\s*\['var\(--fs-large-title\)'/);
    expect(tw).toMatch(/score:\s*\['var\(--fs-score\)'/);
  });

  it('cards get a hairline shadow in light and none in dark', () => {
    expect(css).toMatch(/:root\s*\{[^}]*--shadow-card:\s*0 1px 2px rgba\(0, 0, 0, 0\.04\);/);
    expect(css).toMatch(/\.dark\s*\{[^}]*--shadow-card:\s*none;/);
    const tw = readFileSync(resolve(process.cwd(), 'tailwind.config.js'), 'utf8');
    expect(tw).toMatch(/card:\s*'var\(--shadow-card\)'/);
  });

  it('the canvas eases a theme change over 200 ms, instantly with reduced motion', () => {
    expect(css).toMatch(/html,\s*body\s*\{[^}]*transition:\s*background-color 200ms ease/);
    expect(mediaBlock('prefers-reduced-motion: reduce')).toMatch(/html,\s*body\s*\{[^}]*transition:\s*none/);
  });

  it('forced colors keep a visible focus outline', () => {
    expect(mediaBlock('forced-colors: active')).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid CanvasText/);
  });

  it('opaque root containers carry .canvas, which eases and is instant with reduced motion', () => {
    expect(css).toMatch(/\.canvas\s*\{[^}]*transition:\s*background-color 200ms ease/);
    expect(mediaBlock('prefers-reduced-motion: reduce')).toMatch(/\.canvas\s*\{[^}]*transition:\s*none/);
    for (const f of ['layout/AppShell.tsx', 'auth/AuthShell.tsx', 'layout/MinimalShell.tsx', 'legal/LegalDocPage.tsx']) {
      expect(readFileSync(resolve(process.cwd(), 'src', f), 'utf8'), f).toMatch(/className="[^"]*canvas[^"]*bg-bg/);
    }
    expect(readFileSync(resolve(process.cwd(), 'src/auth/AuthShell.tsx'), 'utf8')).toMatch(/canvas[^"]*bg-sidebar/);
  });
});
