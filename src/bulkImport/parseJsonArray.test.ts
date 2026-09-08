import { describe, expect, it } from 'vitest';
import { parseJsonArray, isPlainObject, MAX_IMPORT } from './parseJsonArray';

describe('parseJsonArray', () => {
  it('rejects blank input', () => {
    expect(parseJsonArray('   ')).toEqual({ ok: false, error: 'paste or upload some JSON first' });
  });

  it('rejects invalid JSON with the parser message', () => {
    const result = parseJsonArray('[{bad}]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^that is not valid JSON: /i);
  });

  it('rejects a non-array top level', () => {
    expect(parseJsonArray('{"name":"x"}')).toEqual({
      ok: false,
      error: 'the top level must be a JSON array (square brackets)',
    });
  });

  it('rejects an empty array', () => {
    expect(parseJsonArray('[]')).toEqual({ ok: false, error: 'the array is empty — nothing to import' });
  });

  it('rejects more than MAX_IMPORT entries', () => {
    const many = JSON.stringify(new Array(MAX_IMPORT + 1).fill({ a: 1 }));
    expect(parseJsonArray(many)).toEqual({
      ok: false,
      error: 'import is limited to 100 entries at a time; split the file into smaller batches',
    });
  });

  it('accepts exactly MAX_IMPORT entries', () => {
    const many = JSON.stringify(new Array(MAX_IMPORT).fill({ a: 1 }));
    const result = parseJsonArray(many);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows).toHaveLength(MAX_IMPORT);
  });

  it('returns the parsed rows on success', () => {
    expect(parseJsonArray('[{"name":"x"},{"name":"y"}]')).toEqual({
      ok: true,
      rows: [{ name: 'x' }, { name: 'y' }],
    });
  });
});

describe('isPlainObject', () => {
  it('is true for a non-null non-array object', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
  });
  it('is false for null, arrays, and primitives', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(3)).toBe(false);
  });
});
