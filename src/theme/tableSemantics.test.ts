import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const files = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
  .map((f) => [f, readFileSync(join(SRC, f), 'utf8')] as const);

describe('data tables', () => {
  it('give every header cell a scope so screen readers announce it with each value', () => {
    const missing = files.flatMap(([f, text]) =>
      [...text.matchAll(/<th\b[^>]*>/g)].filter((m) => !/\bscope=/.test(m[0])).map(() => f),
    );
    expect(missing).toEqual([]);
  });

  it('do not label rows with aria-label (it replaces the cell contents for screen readers)', () => {
    const labelled = files.flatMap(([f, text]) => [...text.matchAll(/<tr\b[^>]*aria-label=/g)].map(() => f));
    expect(labelled).toEqual([]);
  });
});
