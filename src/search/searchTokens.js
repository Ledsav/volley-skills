// Search-token derivation shared by the app and the Node scripts. Plain ES
// module (no TypeScript syntax) so `.mjs` scripts can import it directly.

export const MAX_TOKENS = 120;
export const MIN_PREFIX = 2;
export const MAX_PREFIX = 12;

/**
 * Lowercase with accents stripped, so "Nicolò" and "nicolo" compare equal.
 * @param {string} s
 * @returns {string}
 */
export function normalize(s) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Normalised words; `#` is kept so "#7" is a word.
 * @param {string} s
 * @returns {string[]}
 */
export function words(s) {
  return normalize(s)
    .split(/[^\p{L}\p{N}#]+/u)
    .filter(Boolean);
}

/**
 * `extra` (a businessId) prefixes and whole value first, then the name's word prefixes (2–12 chars).
 * `#` is dropped from tokens. Deduped, capped at MAX_TOKENS.
 * @param {string} name
 * @param {string} [extra] a training's businessId
 * @returns {string[]}
 */
export function searchTokens(name, extra) {
  /** @type {Set<string>} */
  const out = new Set();
  /** @param {string} s */
  const addPrefixes = (s) => {
    for (const w of words(s)) {
      const word = w.replace(/#/g, '');
      const max = Math.min(word.length, MAX_PREFIX);
      for (let n = MIN_PREFIX; n <= max; n++) out.add(word.slice(0, n));
    }
  };
  if (extra) {
    addPrefixes(extra);
    const whole = normalize(extra).replace(/#/g, '').trim();
    if (whole.length >= MIN_PREFIX) out.add(whole);
  }
  addPrefixes(name);
  return [...out].slice(0, MAX_TOKENS);
}
