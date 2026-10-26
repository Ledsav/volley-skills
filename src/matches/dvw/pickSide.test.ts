import { describe, expect, it } from 'vitest';
import { pickOurSide } from './pickSide';

const teams = (home: string, visiting: string) => ({
  '*': { name: home, setsWon: 0 },
  a: { name: visiting, setsWon: 0 },
});

describe('pickOurSide', () => {
  const appNames = ['Volley Club Test', 'U17'];

  it('picks home when the home team name matches the app names', () => {
    expect(pickOurSide(teams('Volley Club Test', 'Rivali Uno'), appNames)).toBe('*');
  });

  it('picks visiting when the names are swapped', () => {
    expect(pickOurSide(teams('Rivali Uno', 'Volley Club Test'), appNames)).toBe('a');
  });

  it('ignores case, punctuation and accents', () => {
    expect(pickOurSide(teams('Rivali Uno', 'VOLLEY-CLUB TÉST u17'), ['volley club test'])).toBe('a');
  });

  it('defaults to home when nothing matches', () => {
    expect(pickOurSide(teams('Alpha', 'Beta'), appNames)).toBe('*');
  });
});
