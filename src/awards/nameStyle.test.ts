import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNameStyle, styleName, writeNameStyle } from './nameStyle';

const p = { playerId: 'a', name: 'Lena Peeters', number: 12, current: true };

describe('nameStyle', () => {
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('formats', () => {
    expect(styleName(p, 'full')).toBe('Lena Peeters');
    expect(styleName(p, 'firstInitial')).toBe('Lena P.');
    expect(styleName(p, 'first')).toBe('Lena');
    expect(styleName(p, 'number')).toBe('#12');
  });

  it('handles single names, extra spaces and no number', () => {
    expect(styleName({ ...p, name: '  Zoë  ' }, 'firstInitial')).toBe('Zoë');
    expect(styleName({ ...p, name: 'Ana  van  Damme' }, 'firstInitial')).toBe('Ana v.');
    expect(styleName({ ...p, number: null }, 'number')).toBe('Lena P.');
  });

  it('defaults to firstInitial and persists; survives throwing storage', () => {
    expect(readNameStyle()).toBe('firstInitial');
    writeNameStyle('first');
    expect(readNameStyle()).toBe('first');
    localStorage.setItem('vcb.awards.nameStyle', 'bogus');
    expect(readNameStyle()).toBe('firstInitial');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('x'); });
    expect(readNameStyle()).toBe('firstInitial');
  });
});
