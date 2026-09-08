export const MAX_IMPORT = 100;

export type ParseResult = { ok: true; rows: unknown[] } | { ok: false; error: string };

export function parseJsonArray(text: string): ParseResult {
  if (text.trim() === '') {
    return { ok: false, error: 'paste or upload some JSON first' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `that is not valid JSON: ${message}` };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'the top level must be a JSON array (square brackets)' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'the array is empty — nothing to import' };
  }
  if (parsed.length > MAX_IMPORT) {
    return {
      ok: false,
      error: `import is limited to ${MAX_IMPORT} entries at a time; split the file into smaller batches`,
    };
  }
  return { ok: true, rows: parsed };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
