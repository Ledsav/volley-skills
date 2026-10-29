import type { Grade } from '../../types/match';

/** Segment colours of the report's grade bars: green for good, neutral for `!`, orange for poor, red for errors. */
export const GRADE_BAR_CLASS: Record<Grade, string> = {
  '#': 'bg-green',
  '+': 'bg-green/45',
  '!': 'bg-ink-3/40',
  '-': 'bg-orange/40',
  '/': 'bg-orange/75',
  '=': 'bg-red',
};
