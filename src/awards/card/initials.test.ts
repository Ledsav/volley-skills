import { describe, expect, it } from 'vitest';
import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letters of the first two words', () => {
    expect(initialsOf('Lena P.')).toBe('LP');
    expect(initialsOf('Ana')).toBe('A');
    expect(initialsOf('ana maría lópez')).toBe('AM');
    expect(initialsOf('  ')).toBe('');
    expect(initialsOf('Łukasz Nowak')).toBe('ŁN');
  });
});
