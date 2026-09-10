import { describe, expect, it } from 'vitest';
import { ageFromDob } from './age';

describe('ageFromDob', () => {
  const today = new Date('2026-09-10');

  it('returns whole years elapsed since the date of birth', () => {
    expect(ageFromDob('2010-09-10', today)).toBe(16);
    expect(ageFromDob('2010-01-01', today)).toBe(16);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFromDob('2010-09-11', today)).toBe(15);
    expect(ageFromDob('2010-12-31', today)).toBe(15);
  });

  it('returns null for a missing or malformed date of birth', () => {
    expect(ageFromDob('', today)).toBeNull();
    expect(ageFromDob('not-a-date', today)).toBeNull();
    expect(ageFromDob('2010-13-40', today)).toBeNull();
  });

  it('defaults to today when no reference date is given', () => {
    const bornExactlyTenYearsAgo = new Date();
    bornExactlyTenYearsAgo.setFullYear(bornExactlyTenYearsAgo.getFullYear() - 10);
    expect(ageFromDob(bornExactlyTenYearsAgo.toISOString().slice(0, 10))).toBe(10);
  });
});
