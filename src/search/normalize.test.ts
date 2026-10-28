import { describe, expect, it } from 'vitest';
import { normalize, words } from './normalize';

describe('normalize', () => {
  it('lowercases and strips accents', () => {
    expect(normalize('Nicolò ÀLVAREZ')).toBe('nicolo alvarez');
  });
  it('splits words and keeps #numbers', () => {
    expect(words('U17 – Femminile #7')).toEqual(['u17', 'femminile', '#7']);
  });
});
