import type { Grade } from '../../types/match';

export const GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green-strong text-on-ink',
  '+': 'bg-green/15 text-ink',
  '!': 'border border-border bg-bg text-ink',
  '-': 'bg-orange/20 text-ink',
  '/': 'bg-orange/40 text-ink',
  '=': 'bg-red-strong text-on-ink',
};

/** Scouting grade chips: a tint with `-strong` text; `!` is neutral. Errors read red, poor orange, good green. */
export const SCOUT_GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green/40 text-green-strong',
  '+': 'bg-green-tint text-green-strong',
  '!': 'bg-surface-2 text-ink-2',
  '-': 'bg-orange-tint text-orange-strong',
  '/': 'bg-orange/40 text-orange-strong',
  '=': 'bg-red/40 text-red-strong',
};
