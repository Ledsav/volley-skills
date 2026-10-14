import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// iOS Safari zooms the page when a text field or select under 16px gets focus.
// Fields may shrink from `sm` up (`text-base sm:text-sm`) but never on phones.
const SRC = resolve(process.cwd(), 'src');
const SMALL = /(^|[\s"'`{])text-(xs|sm|\[(9|10|11|12|13|14|15)px\])(?=[\s"'`}])/;
const NON_TEXT = /type="(checkbox|radio|range|file|color|hidden)"/;

function sources(): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.tsx') && !f.includes('.test.'))
    .map((f) => join(SRC, f));
}

function offenders(): string[] {
  const found: string[] = [];
  for (const file of sources()) {
    const text = readFileSync(file, 'utf8');
    // The opening tag plus its props: up to the next element.
    for (const m of text.matchAll(/<(input|select|textarea|Input|Textarea)\b[^<]*/g)) {
      if (!NON_TEXT.test(m[0]) && SMALL.test(m[0])) found.push(`${file.slice(SRC.length + 1)}: <${m[1]}>`);
    }
    // Shared class constants built on the field base class.
    for (const line of text.split('\n')) {
      if (line.includes('FIELD_CLASS') && !line.includes('export const FIELD_CLASS') && SMALL.test(line)) {
        found.push(`${file.slice(SRC.length + 1)}: ${line.trim()}`);
      }
    }
  }
  return found;
}

describe('form fields on phones', () => {
  it('never use text under 16px without an sm: override (prevents iOS focus zoom)', () => {
    expect(offenders()).toEqual([]);
  });
});
