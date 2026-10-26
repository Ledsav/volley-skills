/** Reads the text-encoding code page (field 9 of the first [3MATCH] line) from a latin1 view of the bytes. */
function declaredCodePage(bytes: ArrayBuffer): string {
  const text = new TextDecoder('latin1').decode(bytes);
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === '[3MATCH]');
  if (at < 0) return '1252';
  const cp = (lines[at + 1] ?? '').split(';')[8]?.trim() ?? '';
  return /^\d{3,4}$/.test(cp) ? cp : '1252';
}

/** UTF-8 when valid, else the code page declared in [3MATCH] (default windows-1252). */
export function decodeDvw(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // not UTF-8
  }
  try {
    return new TextDecoder(`windows-${declaredCodePage(bytes)}`).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
