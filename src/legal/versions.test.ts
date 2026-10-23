import { describe, expect, it } from 'vitest';
import {
  defaultLegalLang, inForce, inForceIn, needsReviewIn, parseVersionKey, upcoming, upcomingIn, versionKey,
  type LegalVersion,
} from './versions';

const v = (version: string, announcedAt: string, effectiveFrom: string, material = true): LegalVersion =>
  ({ version, announcedAt, effectiveFrom, material, summary: 's' });

describe('versions', () => {
  it('finds the version in force and throws before the first', () => {
    expect(inForce('terms', new Date('2026-10-22T00:00:00Z')).version).toBe('2026-10-22');
    expect(() => inForce('terms', new Date('2026-10-21T23:59:59Z'))).toThrow();
  });

  it('has nothing upcoming today', () => {
    expect(upcoming('terms', new Date('2026-10-22T00:00:00Z'))).toBeNull();
  });

  it('announces then enforces a later version', () => {
    const list = [v('2026-10-22', '2026-10-22', '2026-10-22'), v('2026-12-01', '2026-11-01', '2026-12-01')];
    expect(upcomingIn(list, new Date('2026-11-15T00:00:00Z'))?.version).toBe('2026-12-01');
    expect(inForceIn(list, new Date('2026-11-15T00:00:00Z')).version).toBe('2026-10-22');
    expect(upcomingIn(list, new Date('2026-12-01T00:00:00Z'))).toBeNull();
    expect(inForceIn(list, new Date('2026-12-01T00:00:00Z')).version).toBe('2026-12-01');
  });

  describe('needsReviewIn', () => {
    const base = v('2026-10-22', '2026-10-22', '2026-10-22');
    const legal = { versionKey: 'terms-2026-10-22_dpa-2026-10-22', acceptedAt: null, acceptedBy: 'a@b.c' };
    const date = new Date('2026-12-02T00:00:00Z');
    it('is true without acceptance', () => {
      expect(needsReviewIn({ terms: [base], dpa: [base], subprocessors: [base] }, null, date)).toBe(true);
    });
    it('ignores non-material newer versions', () => {
      const vs = { terms: [base, v('2026-12-01', '2026-11-01', '2026-12-01', false)], dpa: [base], subprocessors: [base] };
      expect(needsReviewIn(vs, legal, date)).toBe(false);
    });
    it('flags a material newer version', () => {
      const vs = { terms: [base], dpa: [base, v('2026-12-01', '2026-11-01', '2026-12-01', true)], subprocessors: [base] };
      expect(needsReviewIn(vs, legal, date)).toBe(true);
    });
    it('flags an unparsable key', () => {
      expect(needsReviewIn({ terms: [base], dpa: [base], subprocessors: [base] }, { ...legal, versionKey: 'x' }, date)).toBe(true);
    });
  });

  it('builds and parses version keys', () => {
    expect(versionKey('a', 'b')).toBe('terms-a_dpa-b');
    expect(parseVersionKey(versionKey('2026-10-22', '2026-11-01'))).toEqual({ terms: '2026-10-22', dpa: '2026-11-01' });
    expect(parseVersionKey('x')).toBeNull();
  });

  it('picks a default language', () => {
    expect(defaultLegalLang('it-IT')).toBe('it');
    expect(defaultLegalLang('pt-BR')).toBe('en');
    expect(defaultLegalLang(undefined)).toBe('en');
  });
});
