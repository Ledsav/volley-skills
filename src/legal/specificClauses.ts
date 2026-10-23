import { extractClause, legalText } from './legalDocs';
import type { LegalLang } from './versions';

export const SPECIFIC_CLAUSE_IDS = {
  terms: ['T2', 'T8', 'T9', 'T11', 'T12', 'T13', 'T14', 'T15', 'T20', 'T21'],
  dpa: ['D5', 'D9', 'D11'],
} as const;

export interface SpecificClause {
  id: string;
  heading: string;
  text: string;
}

export function specificClauses(termsVersion: string, dpaVersion: string, lang: LegalLang): SpecificClause[] {
  const sources = [
    { md: legalText('terms', termsVersion, lang), ids: SPECIFIC_CLAUSE_IDS.terms },
    { md: legalText('dpa', dpaVersion, lang), ids: SPECIFIC_CLAUSE_IDS.dpa },
  ];
  const out: SpecificClause[] = [];
  const missing: string[] = [];
  for (const { md, ids } of sources) {
    for (const id of ids) {
      const c = extractClause(md, id);
      if (c) out.push(c); else missing.push(id);
    }
  }
  if (missing.length) throw new Error(`Missing specific clauses: ${missing.join(', ')}`);
  return out;
}

export function clausesText(clauses: SpecificClause[]): string {
  return clauses.map((c) => `${c.id}. ${c.heading}\n\n${c.text}`).join('\n\n---\n\n');
}
