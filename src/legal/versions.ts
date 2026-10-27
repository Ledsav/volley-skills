import type { ClubLegal } from '../types/club';
import versionsJson from './content/versions.json';

export const LEGAL_LANGS = ['en', 'it', 'fr', 'de', 'es'] as const;
export type LegalLang = typeof LEGAL_LANGS[number];
export type LegalDocId = 'terms' | 'dpa' | 'subprocessors' | 'privacy' | 'dpia-pack';
export type VersionedDoc = 'terms' | 'dpa' | 'subprocessors';

export interface LegalVersion {
  version: string;
  announcedAt: string;
  effectiveFrom: string;
  material: boolean;
  summary: string;
  /** Optional summaries in the app's UI language; `summary` (English) is the fallback. */
  summaries?: { it?: string };
}

export type VersionTable = Record<VersionedDoc, LegalVersion[]>;

const VERSIONS = versionsJson as VersionTable;

/** Dates compare as YYYY-MM-DD strings in UTC. */
const day = (d: Date): string => d.toISOString().slice(0, 10);

export function inForceIn(list: LegalVersion[], date: Date): LegalVersion {
  const today = day(date);
  const live = list.filter((v) => v.effectiveFrom <= today).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const latest = live[live.length - 1];
  if (!latest) throw new Error(`No legal version in force on ${today}`);
  return latest;
}

export function upcomingIn(list: LegalVersion[], date: Date): LegalVersion | null {
  const today = day(date);
  const next = list
    .filter((v) => v.announcedAt <= today && today < v.effectiveFrom)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return next[0] ?? null;
}

export function versionKey(terms: string, dpa: string): string {
  return `terms-${terms}_dpa-${dpa}`;
}

export function parseVersionKey(key: string): { terms: string; dpa: string } | null {
  const m = /^terms-(.+)_dpa-(.+)$/.exec(key);
  return m ? { terms: m[1], dpa: m[2] } : null;
}

/** True when the accepted versions are outdated by a material version now in force. */
export function needsReviewIn(versions: VersionTable, legal: ClubLegal | null, date: Date): boolean {
  if (!legal) return true;
  const accepted = parseVersionKey(legal.versionKey);
  if (!accepted) return true;
  const today = day(date);
  const outdated = (list: LegalVersion[], acceptedVersion: string) =>
    list.some((v) => v.material && v.effectiveFrom <= today && v.version > acceptedVersion);
  return outdated(versions.terms, accepted.terms) || outdated(versions.dpa, accepted.dpa);
}

export const inForce = (doc: VersionedDoc, date: Date): LegalVersion => inForceIn(VERSIONS[doc], date);
export const upcoming = (doc: VersionedDoc, date: Date): LegalVersion | null => upcomingIn(VERSIONS[doc], date);
export const needsReview = (legal: ClubLegal | null, date: Date): boolean => needsReviewIn(VERSIONS, legal, date);

export const CURRENT_DOC_VERSION: Record<'privacy' | 'dpia-pack', string> = {
  privacy: '2026-10-22',
  'dpia-pack': '2026-10-22',
};

export const DRAFT_BANNER: Record<LegalLang, string> = {
  en: 'Draft — under legal review',
  it: 'Bozza — in corso di revisione legale',
  fr: 'Projet — en cours de revue juridique',
  de: 'Entwurf — in rechtlicher Prüfung',
  es: 'Borrador — en revisión jurídica',
};

export const SPECIFIC_SENTENCE: Record<LegalLang, string> = {
  en: 'This clause is approved specifically at signature.',
  it: 'Questa clausola è approvata specificamente alla firma.',
  fr: 'Cette clause est approuvée spécifiquement lors de la signature.',
  de: 'Diese Klausel wird bei der Unterzeichnung gesondert genehmigt.',
  es: 'Esta cláusula se aprueba específicamente en la firma.',
};

export function defaultLegalLang(navigatorLanguage: string | undefined): LegalLang {
  const base = navigatorLanguage?.toLowerCase().split('-')[0];
  return (LEGAL_LANGS as readonly string[]).includes(base ?? '') ? (base as LegalLang) : 'en';
}
