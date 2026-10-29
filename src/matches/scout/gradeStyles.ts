import type { Grade } from '../../types/match';

/**
 * Scouting grade chips. The two decisive grades are solid with on-ink text (green `#` 10.4:1, red `=` 6.2:1 on
 * the dark tokens); `+`, `-` and `/` are tints with a ring and `-strong` text (5.9:1, 6.1:1, 6.1:1); `!` is
 * neutral (ink-2 on surface-2, 5.4:1). Every label clears AA 4.5:1.
 */
export const SCOUT_GRADE_CLASS: Record<Grade, string> = {
  '#': 'bg-green text-on-ink',
  '+': 'bg-green-tint text-green-strong ring-1 ring-inset ring-green/50',
  '!': 'bg-surface-2 text-ink-2',
  '-': 'bg-orange-tint text-orange-strong ring-1 ring-inset ring-orange/40',
  '/': 'bg-orange-tint text-orange-strong ring-1 ring-inset ring-orange/70',
  '=': 'bg-red text-on-ink',
};
