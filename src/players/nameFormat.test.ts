import { describe, expect, it } from 'vitest';
import { getInitials } from './nameFormat';

describe('getInitials', () => {
  it('takes the first letter of the first and last word for a full name', () => {
    expect(getInitials('Alberto Valdes Rey')).toBe('AR');
  });

  it('uppercases the letters', () => {
    expect(getInitials('emma laurent')).toBe('EL');
  });

  it('returns a single letter for a one-word name', () => {
    expect(getInitials('Cher')).toBe('C');
  });

  it('returns an empty string for an empty name', () => {
    expect(getInitials('')).toBe('');
  });

  it('ignores extra whitespace between words', () => {
    expect(getInitials('  Anna   Müller  ')).toBe('AM');
  });
});
