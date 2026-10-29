export type StripKind = 'error' | 'matchOver' | 'betweenSets' | 'inserting';

/** One strip at a time, most important first. */
export function pickStrip(f: { error: boolean; matchOver: boolean; betweenSets: boolean; inserting: boolean }): StripKind | null {
  if (f.error) return 'error';
  if (f.matchOver) return 'matchOver';
  if (f.betweenSets) return 'betweenSets';
  if (f.inserting) return 'inserting';
  return null;
}
