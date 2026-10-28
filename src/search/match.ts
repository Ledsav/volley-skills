import { normalize, words } from './normalize';
import type { SearchItem } from './types';

/** 0 exact label, 1 prefix of the label's first word, 2 prefix of any label/keyword word, null no match. */
export function matchRank(query: string, item: SearchItem): number | null {
  const qn = normalize(query).trim();
  if (!qn) return null;
  if (qn === normalize(item.label).trim()) return 0;
  const qw = words(query);
  if (qw.length === 0) return null;
  const labelWords = words(item.label);
  const itemWords = [...labelWords, ...(item.keywords ?? []).flatMap((k) => words(k))];
  if (!qw.every((q) => itemWords.some((w) => w.startsWith(q)))) return null;
  const first = labelWords[0];
  return first !== undefined && first.startsWith(qw[0]) ? 1 : 2;
}

/** Matches only, by rank, then most recently used, then label. */
export function rankItems(query: string, items: SearchItem[], recentIds: string[]): SearchItem[] {
  const recentIndex = (id: string) => {
    const i = recentIds.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return items
    .map((item) => ({ item, rank: matchRank(query, item) }))
    .filter((x): x is { item: SearchItem; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || recentIndex(a.item.id) - recentIndex(b.item.id) || a.item.label.localeCompare(b.item.label))
    .map((x) => x.item);
}
