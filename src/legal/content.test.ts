import { describe, expect, it } from 'vitest';
import { clauseIds, extractClause, legalText, rawLegalText } from './legalDocs';
import { SPECIFIC_CLAUSE_IDS, specificClauses } from './specificClauses';
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

/** DPA clause ids in legal design §4 order; the annexes follow D12. */
export const DPA_IDS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12'];

describe('other docs en', () => {
  const dpa = rawLegalText('dpa', '2026-10-22', 'en') ?? '';
  const subprocessors = rawLegalText('subprocessors', '2026-10-22', 'en') ?? '';
  const privacy = rawLegalText('privacy', '2026-10-22', 'en') ?? '';
  const dpiaPack = rawLegalText('dpia-pack', '2026-10-22', 'en') ?? '';

  it('DPA has every clause in order and the three annexes after D12', () => {
    expect(clauseIds(dpa)).toEqual(DPA_IDS);
    const d12 = dpa.indexOf('\n## D12.');
    for (const annex of ['## Annex I.', '## Annex II.', '## Annex III.']) {
      expect(dpa).toContain(`\n${annex}`);
      expect(dpa.indexOf(`\n${annex}`)).toBeGreaterThan(d12);
    }
  });

  it('DPA states the breach window, backup expiry and support rate, and names no audit logs', () => {
    expect(dpa).toContain('48 hours');
    expect(dpa).toContain('35 days');
    expect(dpa).toContain('{{SUPPORT_HOURLY_RATE}}');
    expect(dpa.toLowerCase()).not.toContain('audit log');
  });

  it('extracts the specific clauses in P4 order, each ending with the specific sentence', () => {
    const clauses = specificClauses('2026-10-22', '2026-10-22', 'en');
    expect(clauses.map((c) => c.id)).toEqual([...SPECIFIC_CLAUSE_IDS.terms, ...SPECIFIC_CLAUSE_IDS.dpa]);
    for (const c of clauses) expect(c.text.endsWith(SPECIFIC_SENTENCE.en), c.id).toBe(true);
  });

  it('sub-processor list names Google, Firebase Authentication, reCAPTCHA and the AI provider exclusion', () => {
    expect(subprocessors).toContain('Google Ireland');
    expect(subprocessors).toContain('Firebase Authentication');
    expect(subprocessors).toContain('reCAPTCHA');
    expect(subprocessors).toMatch(/^## .*not sub-processors/im);
    expect(subprocessors).toMatch(/AI provider/);
  });

  it('privacy notice states both roles, the CNPD, the privacy contact and the storage keys', () => {
    for (const s of ['controller', 'processor', 'CNPD', '{{OPERATOR_PRIVACY_EMAIL}}', 'vcb.activeClub', 'vcb.signDraft', 'emailForSignIn']) {
      expect(privacy, s).toContain(s);
    }
  });

  it('DPIA pack covers minors, profiling, photos, AI and a checklist', () => {
    for (const s of ['minors', 'profiling', 'photos', 'AI', 'checklist']) expect(dpiaPack, s).toContain(s);
  });

  it('every document carries the banner after its title and renders', () => {
    for (const doc of ['dpa', 'subprocessors', 'privacy', 'dpia-pack'] as const) {
      const raw = rawLegalText(doc, '2026-10-22', 'en') ?? '';
      const lines = raw.split('\n');
      expect(lines[0], doc).toMatch(/^# \S/);
      expect(raw, doc).toContain(`> **${DRAFT_BANNER.en}.**`);
      expect(() => legalText(doc, '2026-10-22', 'en'), doc).not.toThrow();
    }
  });
});

const placeholders = (s: string): string[] => [...new Set(s.match(/\{\{[A-Z_]+\}\}/g) ?? [])].sort();
const DOCS = ['terms', 'dpa', 'subprocessors', 'privacy', 'dpia-pack'] as const;

describe.each(['it', 'fr'] as const)('translations %s', (lang) => {
  const raw = (doc: (typeof DOCS)[number]) => rawLegalText(doc, '2026-10-22', lang) ?? '';
  const en = (doc: (typeof DOCS)[number]) => rawLegalText(doc, '2026-10-22', 'en') ?? '';

  it('keeps the clause ids of the English texts', () => {
    expect(clauseIds(raw('terms'))).toEqual(TERMS_IDS);
    expect(clauseIds(raw('dpa'))).toEqual(DPA_IDS);
  });

  it('carries the draft banner in all five documents', () => {
    for (const doc of DOCS) expect(raw(doc), doc).toContain(DRAFT_BANNER[lang]);
  });

  it('ends every specific-approval clause with the specific sentence', () => {
    for (const doc of ['terms', 'dpa'] as const) {
      for (const id of SPECIFIC_CLAUSE_IDS[doc]) {
        const clause = extractClause(raw(doc), id);
        expect(clause?.text, `${doc} ${id}`).toBeTruthy();
        expect(clause!.text.endsWith(SPECIFIC_SENTENCE[lang]), `${doc} ${id}`).toBe(true);
      }
    }
  });

  it('renders all five documents', () => {
    for (const doc of DOCS) expect(() => legalText(doc, '2026-10-22', lang), doc).not.toThrow();
  });

  it('uses the same placeholders as the English texts', () => {
    for (const doc of DOCS) expect(placeholders(raw(doc)), doc).toEqual(placeholders(en(doc)));
  });

  it('has three annex headings in the DPA', () => {
    expect(raw('dpa').match(/^## (?!D\d)/gm)?.length).toBe(en('dpa').match(/^## (?!D\d)/gm)?.length);
    expect(raw('dpa').match(/^## \S+ (I|II|III)\./gm)?.length).toBe(3);
  });
});
