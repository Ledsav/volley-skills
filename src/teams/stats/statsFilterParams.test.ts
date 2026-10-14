import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTER } from './teamSeason';
import { parseStatsFilter, statsFilterToParams } from './statsFilterParams';

describe('statsFilterParams', () => {
  it('keeps an open-ended dates range', () => {
    expect(parseStatsFilter(new URLSearchParams('range=dates&from=2026-09-01&to=')).range).toEqual({ kind: 'dates', from: '2026-09-01', to: '' });
    expect(parseStatsFilter(new URLSearchParams('range=dates&from=&to=2026-10-01')).range).toEqual({ kind: 'dates', from: '', to: '2026-10-01' });
    expect(parseStatsFilter(new URLSearchParams('range=dates')).range).toEqual({ kind: 'dates', from: '', to: '' });
    const f = { ...DEFAULT_FILTER, range: { kind: 'dates' as const, from: '', to: '2026-10-01' } };
    expect(parseStatsFilter(statsFilterToParams(f))).toEqual(f);
  });

  it('round-trips', () => {
    const f = { competition: 'cup' as const, homeAway: 'away' as const, range: { kind: 'dates' as const, from: '2026-09-01', to: '2026-10-01' } };
    expect(parseStatsFilter(statsFilterToParams(f))).toEqual(f);
    expect(parseStatsFilter(statsFilterToParams({ ...DEFAULT_FILTER, range: { kind: 'last', count: 10 } })).range).toEqual({ kind: 'last', count: 10 });
  });

  it('defaults on garbage', () => {
    expect(parseStatsFilter(new URLSearchParams('comp=lol&range=last7&ha=x&from=bad'))).toEqual(DEFAULT_FILTER);
  });

  it('default filter produces empty params', () => {
    expect(statsFilterToParams(DEFAULT_FILTER).toString()).toBe('');
  });
});
