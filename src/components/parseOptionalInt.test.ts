import { describe, expect, it } from 'vitest';
import { parseOptionalInt } from './parseOptionalInt';

describe('parseOptionalInt', () => {
  it('reads blank as not set', () => {
    expect(parseOptionalInt('', 1, 30)).toEqual({ ok: true, value: null });
    expect(parseOptionalInt('  ', 1, 30)).toEqual({ ok: true, value: null });
  });

  it('reads a whole number in range', () => {
    expect(parseOptionalInt('6', 1, 30)).toEqual({ ok: true, value: 6 });
    expect(parseOptionalInt(' 30 ', 1, 30)).toEqual({ ok: true, value: 30 });
  });

  it.each(['0', '31', '7.5', 'abc', '-3'])('rejects %s', (raw) => {
    expect(parseOptionalInt(raw, 1, 30)).toEqual({ ok: false });
  });
});
