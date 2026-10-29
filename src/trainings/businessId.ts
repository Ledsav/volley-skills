export function formatBusinessId(sequence: number): string {
  return `TR-${String(sequence).padStart(4, '0')}`;
}

/** "TR-7", "tr-0007" or "7" -> "TR-0007"; null for anything that is not a business ID. */
export function asBusinessId(text: string): string | null {
  const m = /^(?:tr-?)?(\d{1,6})$/i.exec(text.trim());
  return m ? formatBusinessId(Number(m[1])) : null;
}
