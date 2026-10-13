import { describe, expect, it } from 'vitest';
import { fileSlug, toExportable } from './exportJson';

describe('toExportable', () => {
  it('turns nested Timestamps into ISO strings and drops undefined', () => {
    const ts = { toDate: () => new Date('2026-01-02T03:04:05.000Z') };
    expect(
      toExportable({ a: ts, b: [ts, { c: ts }], d: null, e: undefined, f: 3, g: 'x' }),
    ).toEqual({
      a: '2026-01-02T03:04:05.000Z',
      b: ['2026-01-02T03:04:05.000Z', { c: '2026-01-02T03:04:05.000Z' }],
      d: null,
      f: 3,
      g: 'x',
    });
  });
});

describe('fileSlug', () => {
  it('keeps letters and digits, collapses the rest', () => {
    expect(fileSlug(' U17 Girls / Équipe A ')).toBe('U17-Girls-Équipe-A');
    expect(fileSlug('///')).toBe('export');
  });
});
