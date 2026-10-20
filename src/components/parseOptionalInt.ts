/** Reads an optional whole-number form field: blank => null (not set); out of range or fractional => not ok. */
export function parseOptionalInt(
  raw: string,
  min: number,
  max: number,
): { ok: true; value: number | null } | { ok: false } {
  const text = raw.trim();
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false };
  const value = Number(text);
  return value >= min && value <= max ? { ok: true, value } : { ok: false };
}
