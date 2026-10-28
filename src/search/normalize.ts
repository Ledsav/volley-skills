/** Lowercase with accents stripped, so "Nicolò" and "nicolo" compare equal. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Normalised words; `#` is kept so "#7" is a word. */
export function words(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}#]+/u)
    .filter(Boolean);
}
