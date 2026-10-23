import { OPERATOR } from './operator';
import type { LegalDocId, LegalLang } from './versions';

const FILES = import.meta.glob('./content/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export function rawLegalText(doc: LegalDocId, version: string, lang: LegalLang): string | null {
  return FILES[`./content/${lang}/${doc}-${version}.md`] ?? null;
}

const ADDRESS_MARKER = '[to be completed: operator address]';

/** Labels carry their own colon spacing (French puts a space before it). */
const VAT_LABEL: Record<LegalLang, string> = {
  en: 'VAT:', it: 'Partita IVA:', fr: 'TVA :', de: 'USt-IdNr.:', es: 'NIF-IVA:',
};
const REGISTRATION_LABEL: Record<LegalLang, string> = {
  en: 'Registration:', it: 'Iscrizione:', fr: 'Immatriculation :', de: 'Registrierung:', es: 'Registro:',
};

export function substitutePlaceholders(text: string, lang: LegalLang, operator: typeof OPERATOR = OPERATOR): string {
  const values: Record<string, string> = {
    OPERATOR_NAME: operator.name,
    OPERATOR_ADDRESS: operator.address ?? ADDRESS_MARKER,
    OPERATOR_COUNTRY: new Intl.DisplayNames([lang], { type: 'region' }).of(operator.country) ?? operator.country,
    OPERATOR_REGISTRATION: operator.registration ? ` ${REGISTRATION_LABEL[lang]} ${operator.registration}.` : '',
    OPERATOR_VAT: operator.vat ? ` ${VAT_LABEL[lang]} ${operator.vat}.` : '',
    OPERATOR_CONTACT_EMAIL: operator.contactEmail,
    OPERATOR_PRIVACY_EMAIL: operator.privacyEmail,
    SUPPORT_HOURLY_RATE: '€80',
    FREE_USE_LIABILITY_CAP: '€100',
  };
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (whole, name: string) => {
    if (!(name in values)) throw new Error(`Unknown legal placeholder ${whole}`);
    return values[name];
  });
}

export function legalText(doc: LegalDocId, version: string, lang: LegalLang): string {
  const raw = rawLegalText(doc, version, lang);
  if (raw === null) throw new Error(`Missing legal text ${doc} ${version} ${lang}`);
  return substitutePlaceholders(raw, lang);
}

const CLAUSE_HEADING = /^## ([TD]\d+)\. (.*)$/;

export function clauseIds(md: string): string[] {
  return md.split('\n').flatMap((l) => {
    const m = CLAUSE_HEADING.exec(l);
    return m ? [m[1]] : [];
  });
}

export function extractClause(md: string, id: string): { id: string; heading: string; text: string } | null {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => CLAUSE_HEADING.exec(l)?.[1] === id);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return {
    id,
    heading: CLAUSE_HEADING.exec(lines[start])![2].trim(),
    text: lines.slice(start + 1, end).join('\n').trim(),
  };
}
