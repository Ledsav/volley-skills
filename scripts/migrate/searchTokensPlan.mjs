// Pure planner for the searchTokens backfill (UI redesign plan 3). No I/O.
import { searchTokens } from '../../src/search/searchTokens.js';

const same = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Updates for the docs whose stored `searchTokens` is missing or differs (order-sensitive)
 * from the derived tokens. Docs without a string `name` are skipped.
 * @param {{ path: string, kind: 'exercise' | 'training', data: object }[]} docs
 * @returns {{ path: string, searchTokens: string[] }[]}
 */
export function planSearchTokens(docs) {
  const updates = [];
  for (const { path, kind, data } of docs) {
    if (typeof data?.name !== 'string') continue;
    const extra = kind === 'training' && typeof data.businessId === 'string' ? data.businessId : undefined;
    const tokens = searchTokens(data.name, extra);
    if (!same(data.searchTokens, tokens)) updates.push({ path, searchTokens: tokens });
  }
  return updates;
}
