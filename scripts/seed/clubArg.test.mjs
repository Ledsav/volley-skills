import { describe, expect, it } from 'vitest';
import { assertProdClub, newClubDoc, parseClubArg, seedAcceptance } from './clubArg.mjs';

describe('assertProdClub', () => {
  it('throws for --prod without --club', () => expect(() => assertProdClub(['--prod', '--yes'])).toThrow(/--club/));
  it('accepts --prod with --club', () => expect(() => assertProdClub(['--prod', '--club', 'x'])).not.toThrow());
  it('ignores the emulator', () => expect(() => assertProdClub(['--emulator'])).not.toThrow());
});

describe('parseClubArg', () => {
  it('defaults to demo', () => expect(parseClubArg(['--emulator'])).toBe('demo'));
  it('reads the value after --club', () => expect(parseClubArg(['--x', '--club', 'rival'])).toBe('rival'));
});

describe('newClubDoc', () => {
  it('newClubDoc matches the seeded club shape', () => {
    const doc = newClubDoc(
      { name: 'VC', country: 'ES', locale: 'en', ownerEmail: 'a@x.com', status: 'active', aiEnabled: true, growthTestsEnabled: false },
      'NOW',
    );
    expect(new Set(Object.keys(doc))).toEqual(
      new Set(['name', 'country', 'locale', 'ownerEmail', 'aiEnabled', 'referenceOptOut', 'growthTestsEnabled', 'createdAt',
        'status', 'statusReason', 'statusChangedAt', 'statusChangedBy', 'lastStatusLogId', 'legal', 'termination', 'billing']),
    );
    expect(doc).toMatchObject({ createdAt: 'NOW', referenceOptOut: false, legal: null, billing: null, growthTestsEnabled: false });
    expect(doc.termination).toEqual({ requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null });
  });
});

describe('seedAcceptance', () => {
  it('has exactly the Acceptance fields', () => {
    const a = seedAcceptance({
      versionKey: 'terms-1_dpa-1', termsVersion: '1', dpaVersion: '1', subprocessorsVersion: '1', email: 'a@x.com', name: 'A',
    });
    // Copied literally from the Acceptance interface in src/types/club.ts.
    expect(new Set(Object.keys(a))).toEqual(
      new Set(['versionKey', 'termsVersion', 'dpaVersion', 'subprocessorsVersion', 'language', 'termsSha256', 'dpaSha256',
        'clausesSha256', 'specificClauses', 'acceptedBy', 'acceptedByName', 'authorityConfirmed', 'acceptedAt', 'authTime', 'userAgent']),
    );
    expect(a).toMatchObject({
      language: 'en', authTime: 0, userAgent: 'seed-script', authorityConfirmed: true, acceptedBy: 'a@x.com',
      termsSha256: '0'.repeat(64), dpaSha256: '0'.repeat(64), clausesSha256: '0'.repeat(64), specificClauses: [],
    });
  });
});
