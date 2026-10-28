import type { Grade } from '../../types/match';

export const GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green-strong text-on-ink',
  '+': 'bg-green/15 text-ink',
  '!': 'border border-border bg-bg text-ink',
  '-': 'bg-orange/20 text-ink',
  '/': 'bg-orange/40 text-ink',
  '=': 'bg-red-strong text-on-ink',
};
