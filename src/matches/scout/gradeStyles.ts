import type { Grade } from '../../types/match';

export const GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green text-white',
  '+': 'bg-green/15 text-ink',
  '!': 'border border-border bg-bg text-ink',
  '-': 'bg-orange/20 text-ink',
  '/': 'bg-orange/40 text-ink',
  '=': 'bg-red text-white',
};
