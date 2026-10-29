import { describe, expect, it } from 'vitest';
import { fontFor, ROLE, trackPx, type Role } from './type';

describe('type roles', () => {
  it('maps roles to Inter at 500–700', () => {
    expect(fontFor('display', 120)).toBe('700 120px Inter, system-ui, sans-serif');
    expect(fontFor('caption', 32).startsWith('500 ')).toBe(true);
  });

  it('tracking is never positive', () => {
    for (const role of Object.keys(ROLE) as Role[]) {
      for (const size of [30, 120, 320]) expect(trackPx(role, size)).toBeLessThanOrEqual(0);
    }
    expect(trackPx('display', 120)).toBe(-4.2);
  });
});
