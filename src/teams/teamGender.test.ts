import { describe, expect, it } from 'vitest';
import { isGender, teamGender } from './teamGender';

describe('teamGender', () => {
  it('returns the stored gender', () => {
    expect(teamGender({ gender: 'women' })).toBe('women');
    expect(teamGender({ gender: 'men' })).toBe('men');
  });

  it('reads a team without gender as mixed', () => {
    expect(teamGender({})).toBe('mixed');
  });

  it('recognises only the three values', () => {
    expect(isGender('mixed')).toBe(true);
    expect(isGender('female')).toBe(false);
    expect(isGender(undefined)).toBe(false);
  });
});
