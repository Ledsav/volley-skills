export const MAX_IMPORT = 100;

/** Why pasted text could not be read as a list of rows; the UI maps the code to text. */
export type ParseIssue =
  | { code: 'blank' }
  | { code: 'invalidJson'; message: string }
  | { code: 'notArray' }
  | { code: 'empty' }
  | { code: 'tooMany'; max: number };

type ParseResult = { ok: true; rows: unknown[] } | { ok: false; error: ParseIssue };

export function parseJsonArray(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, error: { code: 'blank' } };
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
