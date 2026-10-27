import { describe, expect, it } from 'vitest';
import { plural } from './plural';

const forms = { one: '1 giocatore', other: 'n giocatori' };

describe('plural', () => {
  it('uses one for 1', () => expect(plural('it', 1, forms)).toBe('1 giocatore'));
  it('uses other for 0 and many', () => {
    expect(plural('it', 0, forms)).toBe('n giocatori');
    expect(plural('en', 2, forms)).toBe('n giocatori');
  });
  it('treats non-integers as other', () => {
    expect(plural('en', 1.5, forms)).toBe('n giocatori');
    expect(plural('it', 0.5, forms)).toBe('n giocatori');
  });
});
