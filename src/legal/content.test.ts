import { describe, expect, it } from 'vitest';
import { clauseIds, extractClause, legalText, rawLegalText } from './legalDocs';
import { SPECIFIC_CLAUSE_IDS } from './specificClauses';
import { DRAFT_BANNER, SPECIFIC_SENTENCE } from './versions';

/** Terms clause ids in legal design §3 table order (T24 sits after T13). */
export const TERMS_IDS = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T24',
  'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21', 'T22', 'T23',
];

describe('terms en', () => {
  const raw = rawLegalText('terms', '2026-10-22', 'en') ?? '';

  it('has every clause in the legal design order', () => {
    expect(clauseIds(raw)).toEqual(TERMS_IDS);
  });

  it('ends every specific-approval clause with the specific sentence', () => {
    for (const id of SPECIFIC_CLAUSE_IDS.terms) {
      const clause = extractClause(raw, id);
      expect(clause?.text, id).toBeTruthy();
      expect(clause!.text.endsWith(SPECIFIC_SENTENCE.en), id).toBe(true);
    }
  });

  it('renders with placeholders substituted', () => {
    expect(() => legalText('terms', '2026-10-22', 'en')).not.toThrow();
  });

  it('carries the banner, operator placeholders, free-use cap and language rule', () => {
    expect(raw).toContain(DRAFT_BANNER.en);
    expect(raw).toContain('{{OPERATOR_NAME}}');
    expect(raw).toContain('{{OPERATOR_ADDRESS}}');
    expect(raw).toContain('{{FREE_USE_LIABILITY_CAP}}');
    expect(raw).toContain('English version prevails');
  });
});
