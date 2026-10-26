import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({ serverTimestamp: () => 'TS' }));

const { acceptanceDoc, legalUpdate, signupClubDoc, signupMemberDoc } = await import('./signupDocs');

describe('signupDocs', () => {
  it('builds a pending club with every feature off, owned and accepted by the signer', () => {
    const club = signupClubDoc(
      { name: ' Volley Club ', country: 'it', locale: 'it' },
      'Ada@Example.com',
      'terms-a_dpa-b',
    );
    expect(club).toEqual({
      name: 'Volley Club',
      country: 'IT',
      locale: 'it',
      ownerEmail: 'ada@example.com',
      aiEnabled: false,
      referenceOptOut: false,
      growthTestsEnabled: false,
      createdAt: 'TS',
      status: 'pending',
      statusReason: null,
      statusChangedAt: null,
      statusChangedBy: null,
      lastStatusLogId: null,
      legal: { versionKey: 'terms-a_dpa-b', acceptedAt: 'TS', acceptedBy: 'ada@example.com' },
      termination: {
        requestedAt: null,
        requestedBy: null,
        effectiveAt: null,
        retrievalEndsAt: null,
      },
      billing: null,
    });
  });

  it('builds the admin member, the acceptance and the legal update', () => {
    expect(signupMemberDoc('c1', 'Ada@Example.com')).toEqual({
      email: 'ada@example.com',
      clubId: 'c1',
      role: 'admin',
      addedBy: 'ada@example.com',
      addedAt: 'TS',
    });
    expect(acceptanceDoc({ versionKey: 'k' } as never)).toEqual({
      versionKey: 'k',
      acceptedAt: 'TS',
    });
    expect(legalUpdate('k', 'Ada@Example.com')).toEqual({
      legal: { versionKey: 'k', acceptedAt: 'TS', acceptedBy: 'ada@example.com' },
    });
  });
});
