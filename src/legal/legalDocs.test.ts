import { describe, expect, it, vi } from 'vitest';
import { clauseIds, extractClause, rawLegalText, substitutePlaceholders } from './legalDocs';
import { OPERATOR } from './operator';
import { DRAFT_BANNER, LEGAL_LANGS, type LegalDocId } from './versions';

const op = { ...OPERATOR, address: null, vat: null };

describe('substitutePlaceholders', () => {
  it('fills operator fields and omits null vat', () => {
    expect(substitutePlaceholders('{{OPERATOR_NAME}}, {{OPERATOR_ADDRESS}}, {{OPERATOR_COUNTRY}}.{{OPERATOR_VAT}}', 'en', op))
      .toBe('Alberto Valdes Rey, [to be completed: operator address], Luxembourg.');
  });
  it('localizes the country from a fixed map, not the browser', () => {
    // Signed texts must not depend on the browser's Intl data.
    const spy = vi.spyOn(Intl, 'DisplayNames').mockImplementation(() => {
      throw new Error('Intl.DisplayNames must not be used for legal texts');
    });
    try {
      const names = LEGAL_LANGS.map((lang) => substitutePlaceholders('{{OPERATOR_COUNTRY}}', lang, op));
      expect(names).toEqual(['Luxembourg', 'Lussemburgo', 'Luxembourg', 'Luxemburg', 'Luxemburgo']);
    } finally {
      spy.mockRestore();
    }
  });
  it('refuses an operator country without fixed names', () => {
    expect(() => substitutePlaceholders('{{OPERATOR_COUNTRY}}', 'en', { ...op, country: 'BE' })).toThrow(/BE/);
  });
  it('renders the vat and registration sentences', () => {
    expect(substitutePlaceholders('{{OPERATOR_VAT}}', 'en', { ...op, vat: 'LU123' })).toContain('VAT: LU123.');
    expect(substitutePlaceholders('{{OPERATOR_REGISTRATION}}', 'it', { ...op, registration: 'X' })).toBe(' Iscrizione: X.');
  });
  it('throws on unknown placeholders', () => {
    expect(() => substitutePlaceholders('{{NOPE}}', 'en')).toThrow(/Unknown legal placeholder \{\{NOPE\}\}/);
  });
});

describe('clauses', () => {
  const md = '# T\n\n## T1. Scope\n\nA\n\nB\n\n## T2. Account\n\nC';
  it('extracts a clause', () => {
    expect(extractClause(md, 'T1')).toEqual({ id: 'T1', heading: 'Scope', text: 'A\n\nB' });
    expect(extractClause(md, 'T2')).toEqual({ id: 'T2', heading: 'Account', text: 'C' });
    expect(extractClause(md, 'T3')).toBeNull();
  });
  it('lists clause ids only', () => {
    expect(clauseIds(md)).toEqual(['T1', 'T2']);
    expect(clauseIds(`${md}\n\n## Annex I. X\n\nz`)).toEqual(['T1', 'T2']);
  });
});

describe('rawLegalText', () => {
  const docs: LegalDocId[] = ['terms', 'dpa', 'subprocessors', 'privacy', 'dpia-pack'];
  for (const lang of LEGAL_LANGS) {
    for (const doc of docs) {
      it(`${doc} ${lang} has the draft banner`, () => {
        expect(rawLegalText(doc, '2026-10-22', lang)).toContain(DRAFT_BANNER[lang]);
      });
    }
  }
  it('returns null for an unknown version', () => {
    expect(rawLegalText('terms', '1999-01-01', 'en')).toBeNull();
  });
});
