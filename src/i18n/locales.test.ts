import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locales';

const base = { stored: null, clubLocale: null, browser: [], devParam: null, dev: false, enabled: true } as const;

describe('resolveLocale', () => {
  it('stored choice wins over club and browser', () => {
    expect(resolveLocale({ ...base, stored: 'en', clubLocale: 'it', browser: ['it-IT'] })).toBe('en');
    expect(resolveLocale({ ...base, stored: 'it', clubLocale: 'en' })).toBe('it');
  });
  it('club locale comes next', () => {
    expect(resolveLocale({ ...base, clubLocale: 'it', browser: ['en-US'] })).toBe('it');
  });
  it('ignores an unknown club locale', () => {
    expect(resolveLocale({ ...base, clubLocale: 'fr', browser: ['it'] })).toBe('it');
    expect(resolveLocale({ ...base, clubLocale: 'fr' })).toBe('en');
  });
  it('an Italian browser gives it, others give en', () => {
    expect(resolveLocale({ ...base, browser: ['it-IT'] })).toBe('it');
    expect(resolveLocale({ ...base, browser: ['de-DE'] })).toBe('en');
    expect(resolveLocale(base)).toBe('en');
  });
  it('ignores an unknown stored value', () => {
    expect(resolveLocale({ ...base, stored: 'fr', browser: ['it'] })).toBe('it');
  });
  it('is always en while the flag is off', () => {
    const off = { ...base, enabled: false };
    expect(resolveLocale({ ...off, stored: 'it' })).toBe('en');
    expect(resolveLocale({ ...off, clubLocale: 'it' })).toBe('en');
    expect(resolveLocale({ ...off, browser: ['it-IT'] })).toBe('en');
    expect(resolveLocale({ ...off, devParam: 'it', dev: false })).toBe('en');
  });
  it('the dev param forces it in dev even with the flag off', () => {
    expect(resolveLocale({ ...base, enabled: false, devParam: 'it', dev: true })).toBe('it');
  });
  it('defaults to the real flag (off)', () => {
    const rest = { stored: 'it', clubLocale: null, browser: [], devParam: null, dev: false };
    expect(resolveLocale(rest)).toBe('en');
  });
});
