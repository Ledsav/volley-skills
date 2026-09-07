import { describe, expect, it } from 'vitest';
import { addMonths, buildMonthGrid, formatMonthLabel, monthRange } from './monthGrid';

describe('monthGrid', () => {
  it('builds a Monday-first grid for September 2026 with adjacent-month padding', () => {
    const grid = buildMonthGrid(2026, 8); // September (0-indexed)

    expect(grid[0][0]).toEqual({ date: '2026-08-31', inMonth: false }); // Monday before Sep 1 (a Tuesday)
    expect(grid[0][1]).toEqual({ date: '2026-09-01', inMonth: true });
    expect(grid).toHaveLength(5); // Sep 2026 spans 5 Monday-first weeks
    expect(grid[4][6]).toEqual({ date: '2026-10-04', inMonth: false });
    grid.forEach((week) => expect(week).toHaveLength(7));
  });

  it('computes the first and last ISO date of a month', () => {
    expect(monthRange(2026, 8)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
    expect(monthRange(2026, 1)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });

  it('adds months with year rollover in both directions', () => {
    expect(addMonths(2026, 8, 1)).toEqual({ year: 2026, month: 9 });
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it('formats a human month label', () => {
    expect(formatMonthLabel(2026, 8)).toBe('September 2026');
  });
});
