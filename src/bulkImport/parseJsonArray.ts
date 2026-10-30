import { LIMITS, tooLong } from '../types/limits';
import type { SizeIssue } from './types';

export const MAX_IMPORT = 100;

/** Why pasted text could not be read as a list of rows; the UI maps the code to text. */
export type ParseIssue =
  | { code: 'blank' }
  | { code: 'invalidJson'; message: string }
  | { code: 'notArray' }
  | { code: 'empty' }
  | { code: 'tooMany'; max: number }
  | { code: 'tooLarge'; max: number };

type ParseResult = { ok: true; rows: unknown[] } | { ok: false; error: ParseIssue };

export function parseJsonArray(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, error: { code: 'blank' } };
  }
  // Checked before JSON.parse, so a huge paste never reaches the parser.
  if (text.length > LIMITS.importText) {
    return { ok: false, error: { code: 'tooLarge', max: LIMITS.importText } };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { code: 'invalidJson', message } };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: { code: 'notArray' } };
  }
  if (parsed.length === 0) {
    return { ok: false, error: { code: 'empty' } };
  }
  if (parsed.length > MAX_IMPORT) {
    return { ok: false, error: { code: 'tooMany', max: MAX_IMPORT } };
  }
  return { ok: true, rows: parsed };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A `tooLong` issue when `value` is a string longer than `max`, else null. */
export function textTooLong(row: number, field: string, value: unknown, max: number): SizeIssue | null {
  return tooLong(value, max) ? { code: 'tooLong', row, field, max } : null;
}
