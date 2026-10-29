import { describe, expect, it } from 'vitest';
import { searchTokens } from './searchTokens.js';

describe('searchTokens', () => {
  it('prefixes each word from 2 to 12 characters', () => {
    expect(searchTokens('Muro a tre')).toEqual(['mu', 'mur', 'muro', 'tr', 'tre']);
  });

  it('ignores case and accents', () => {
    const t = searchTokens('Ricezione Città');
    expect(t).toContain('citta');
    expect(t).toContain('ri');
  });

  it('a long word is found by its 12-character prefix', () => {
    const t = searchTokens('Riscaldamento');
    expect(t).toContain('riscaldament');
    expect(t.some((x) => x.length > 12)).toBe(false);
  });

  it('adds the businessId for trainings', () => {
    const t = searchTokens('Attacco', 'TR-0042');
    expect(t).toContain('tr');
    expect(t).toContain('0042');
    expect(t).toContain('tr-0042');
  });

  it('puts businessId tokens first', () => {
    expect(searchTokens('Attacco', 'TR-0042').slice(0, 3)).toEqual(['tr', '00', '004']);
  });

  it('keeps businessId tokens under the cap for a long name', () => {
    const name = Array.from({ length: 30 }, (_, i) => `parola${String.fromCharCode(97 + (i % 26))}${i}xyz`).join(' ');
    const t = searchTokens(name, 'TR-0042');
    expect(t).toHaveLength(120);
    expect(t).toContain('tr-0042');
    expect(t).toContain('0042');
  });

  it('dedupes and caps at 120', () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const name = Array.from({ length: 30 }, (_, i) =>
      (letters[i % 26] + letters[(i * 7) % 26]).repeat(1) + letters.slice(i % 10, (i % 10) + 10),
    ).join(' ');
    const t = searchTokens(name);
    expect(t).toHaveLength(120);
    expect(new Set(t).size).toBe(120);
  });
});
