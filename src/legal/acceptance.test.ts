// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildAcceptance } from './acceptance';
import { sha256Hex } from './hash';
import { legalText } from './legalDocs';
import { clausesText, SPECIFIC_CLAUSE_IDS, specificClauses } from './specificClauses';

const V = '2026-10-22';
const input = {
  termsVersion: V,
  dpaVersion: V,
  subprocessorsVersion: V,
  language: 'it' as const,
  email: '  Founder@Example.COM ',
  personName: '  Ada Rossi ',
  authTime: 1_790_000_000,
  userAgent: 'x'.repeat(400),
};

describe('buildAcceptance', () => {
  it('hashes the texts shown in the chosen language and records the evidence', async () => {
    const a = await buildAcceptance(input);
    expect(a.versionKey).toBe(`terms-${V}_dpa-${V}`);
    expect(a.termsSha256).toBe(await sha256Hex(legalText('terms', V, 'it')));
    expect(a.dpaSha256).toBe(await sha256Hex(legalText('dpa', V, 'it')));
    expect(a.clausesSha256).toBe(await sha256Hex(clausesText(specificClauses(V, V, 'it'))));
    expect(a.termsSha256).not.toBe(
      (await buildAcceptance({ ...input, language: 'en' })).termsSha256,
    );
    expect(a.specificClauses).toEqual([...SPECIFIC_CLAUSE_IDS.terms, ...SPECIFIC_CLAUSE_IDS.dpa]);
    expect(a).toMatchObject({
      termsVersion: V,
      dpaVersion: V,
      subprocessorsVersion: V,
      language: 'it',
      acceptedBy: 'founder@example.com',
      acceptedByName: 'Ada Rossi',
      authorityConfirmed: true,
      authTime: 1_790_000_000,
    });
    expect(a.userAgent).toHaveLength(300);
    expect(a).not.toHaveProperty('acceptedAt');
  });
});
