process.env.TZ = 'Europe/Rome';

import { describe, expect, it } from 'vitest';
import { todayLocalIso } from './today';

describe('todayLocalIso', () => {
  it('uses the local calendar date, not UTC', () => {
    expect(todayLocalIso(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-15');
  });
  it('zero-pads month and day', () => {
    expect(todayLocalIso(new Date(2026, 0, 5, 9))).toBe('2026-01-05');
  });
});
