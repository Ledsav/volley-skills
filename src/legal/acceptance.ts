import type { Acceptance } from '../types/club';
import { sha256Hex } from './hash';
import { legalText } from './legalDocs';
import { clausesText, specificClauses } from './specificClauses';
import { versionKey, type LegalLang } from './versions';

export interface AcceptanceInput {
  termsVersion: string;
  dpaVersion: string;
  subprocessorsVersion: string;
  language: LegalLang;
  email: string;
  personName: string;
  /** The signing token's `auth_time`, in seconds. */
  authTime: number;
  userAgent: string;
}

/** The longest user agent kept on an acceptance (the rules refuse longer). */
export const USER_AGENT_MAX = 300;

/**
 * The acceptance record (spec §6.2) minus `acceptedAt`, which the write sets with
 * `serverTimestamp()`. The hashes are of the exact strings the signing screens render.
 */
export async function buildAcceptance(
  input: AcceptanceInput,
): Promise<Omit<Acceptance, 'acceptedAt'>> {
  const { termsVersion, dpaVersion, subprocessorsVersion, language } = input;
  const clauses = specificClauses(termsVersion, dpaVersion, language);
  const [termsSha256, dpaSha256, clausesSha256] = await Promise.all([
    sha256Hex(legalText('terms', termsVersion, language)),
    sha256Hex(legalText('dpa', dpaVersion, language)),
    sha256Hex(clausesText(clauses)),
  ]);
  return {
    versionKey: versionKey(termsVersion, dpaVersion),
    termsVersion,
    dpaVersion,
    subprocessorsVersion,
    language,
    termsSha256,
    dpaSha256,
    clausesSha256,
    specificClauses: clauses.map((c) => c.id),
    acceptedBy: input.email.trim().toLowerCase(),
    acceptedByName: input.personName.trim(),
    authorityConfirmed: true,
    authTime: input.authTime,
    userAgent: input.userAgent.slice(0, USER_AGENT_MAX),
  };
}
