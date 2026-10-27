import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, formatNumber, formatPercent, monthNames, weekdayNames } from './format';

describe('formatNumber', () => {
  it('uses the locale decimal separator', () => {
    expect(formatNumber(1.5, 1, 'it')).toBe('1,5');
    expect(formatNumber(1.5, 1, 'en')).toBe('1.5');
    expect(formatNumber(7, 0, 'it')).toBe('7');
  });
});

describe('weekdayNames and monthNames', () => {
  it('starts weekdays on Monday', () => {
    expect(weekdayNames('short', 'it')[0]).toBe('lun');
    expect(weekdayNames('short', 'en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
  it('matches the former English month table', () => {
    expect(monthNames('en')).toEqual([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]);
    expect(monthNames('it')[9]).toBe('ottobre');
  });
  it('matches the former English short month abbreviations', () => {
    const short = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((m) => formatDate(`2026-${String(m + 1).padStart(2, '0')}-12`, 'short', 'en').split(' ')[0]);
    expect(short).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  });
});

describe('formatDate and formatMonth', () => {
  it('formats long dates', () => {
    expect(formatDate('2026-10-26', 'long', 'it')).toBe('26 ottobre 2026');
    expect(formatDate('2026-10-26', 'long', 'en')).toBe('October 26, 2026');
  });
  it('formats a month label', () => {
    expect(formatMonth(2026, 8, 'en')).toBe('September 2026');
    expect(formatMonth(2026, 9, 'it')).toBe('ottobre 2026');
  });
});

describe('formatPercent', () => {
  it('rounds and handles null', () => {
    expect(formatPercent(0.456, 'en')).toBe('46%');
    expect(formatPercent(0.456, 'it')).toBe('46%');
    expect(formatPercent(null, 'it')).toBe('—');
  });
});
