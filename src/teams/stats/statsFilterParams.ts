import { DEFAULT_FILTER, type StatsFilter } from './teamSeason';

const COMPETITIONS = ['league', 'cup', 'friendly', 'tournament'] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ISO_OR_EMPTY = (s: string) => s === '' || ISO.test(s);

export function parseStatsFilter(p: URLSearchParams): StatsFilter {
  const comp = p.get('comp');
  const ha = p.get('ha');
  const range = p.get('range');
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  return {
    competition: COMPETITIONS.includes(comp as (typeof COMPETITIONS)[number]) ? (comp as StatsFilter['competition']) : 'all',
    homeAway: ha === 'home' || ha === 'away' ? ha : 'all',
    range:
      range === 'last5' ? { kind: 'last', count: 5 }
      : range === 'last10' ? { kind: 'last', count: 10 }
      : range === 'dates' && ISO_OR_EMPTY(from) && ISO_OR_EMPTY(to) ? { kind: 'dates', from, to }
      : DEFAULT_FILTER.range,
  };
}

export function statsFilterToParams(f: StatsFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.competition !== 'all') p.set('comp', f.competition);
  if (f.homeAway !== 'all') p.set('ha', f.homeAway);
  if (f.range.kind === 'last') p.set('range', `last${f.range.count}`);
  if (f.range.kind === 'dates') {
    p.set('range', 'dates');
    p.set('from', f.range.from);
    p.set('to', f.range.to);
  }
  return p;
}
