/** A Firestore Timestamp (or anything shaped like one). */
function isTimestampLike(value: unknown): value is { toDate: () => Date } {
  return typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function';
}

/**
 * Deep-copies Firestore data into plain JSON: Timestamps become ISO strings,
 * `undefined` fields are dropped, everything else is kept as is.
 */
export function toExportable(value: unknown): unknown {
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toExportable);
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) out[k] = toExportable(v);
    }
    return out;
  }
  return value;
}

/** File-name-safe slug: "U17 Girls / A" → "U17-Girls-A". */
export function fileSlug(text: string): string {
  return text.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'export';
}

/** Saves `text` as a file download. */
export function downloadText(fileName: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Saves `payload` as a pretty-printed JSON download. */
export function downloadJson(fileName: string, payload: unknown): void {
  downloadText(fileName, JSON.stringify(payload, null, 2), 'application/json');
}
