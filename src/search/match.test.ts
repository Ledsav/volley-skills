import { describe, expect, it } from 'vitest';
import { matchRank, rankItems } from './match';
import type { SearchItem } from './types';

const item = (label: string, keywords?: string[], id = label): SearchItem => ({ id, group: 'players', label, keywords });

describe('matchRank', () => {
  it('exact beats first-word prefix beats other-word prefix', () => {
    expect(matchRank('mar', item('Mar'))).toBe(0);
    expect(matchRank('mar', item('Marco Rossi'))).toBe(1);
    expect(matchRank('mar', item('Anna Marino'))).toBe(2);
  });
  it('every typed word must match', () => {
    expect(matchRank('mar ro', item('Marco Rossi'))).not.toBeNull();
    expect(matchRank('mar ro', item('Marco Bianchi'))).toBeNull();
  });
  it('ignores accents both ways', () => {
    expect(matchRank('nicolo', item('Nicolò'))).not.toBeNull();
    expect(matchRank('nicolò', item('Nicolo'))).not.toBeNull();
  });
  it('matches #number keywords', () => {
    expect(matchRank('#7', item('Anna Verdi', ['#7']))).not.toBeNull();
    expect(matchRank('#7', item('Anna Verdi', ['#8']))).toBeNull();
  });
  it('empty query matches nothing', () => {
    expect(matchRank('  ', item('A'))).toBeNull();
  });
});

describe('rankItems', () => {
  it('recents break ties', () => {
    const items = [item('Marco B', undefined, 'a'), item('Marco A', undefined, 'b')];
    expect(rankItems('mar', items, []).map((i) => i.id)).toEqual(['b', 'a']);
    expect(rankItems('mar', items, ['a']).map((i) => i.id)).toEqual(['a', 'b']);
  });
  it('drops non-matches and sorts by rank first', () => {
    const items = [item('Anna Marino', undefined, 'x'), item('Marco', undefined, 'y'), item('Zed', undefined, 'z')];
    expect(rankItems('mar', items, []).map((i) => i.id)).toEqual(['y', 'x']);
  });
});
