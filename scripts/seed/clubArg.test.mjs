import { describe, expect, it } from 'vitest';
import { assertProdClub, newClubDoc, parseClubArg } from './clubArg.mjs';

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
