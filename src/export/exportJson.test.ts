import { describe, expect, it, vi } from 'vitest';
import { fileSlug, toExportable, downloadBlob } from './exportJson';

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

describe('downloadBlob', () => {
  it('keeps the object URL alive after the click so large downloads can finish', () => {
    vi.useFakeTimers();
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadBlob('a.zip', new Blob(['x']));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
    vi.useRealTimers();
  });
});
