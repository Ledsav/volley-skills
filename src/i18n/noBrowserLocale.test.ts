// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('no browser-locale formatting', () => {
  it('never formats dates with the browser locale outside src/i18n', () => {
    const offenders = walk(SRC)
      .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.includes(`${sep}i18n${sep}`))
      .filter((p) => /toLocale(Date|Time)?String\(\s*(undefined|\))/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
