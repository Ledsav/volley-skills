import { serverTimestamp, type DocumentData } from 'firebase/firestore';
import type { Acceptance, ClubLocale } from '../types/club';

// The docs of the sign-up batch (spec §6.3) and of a re-acceptance (§6.4), exactly
// in the shape firestore.rules accepts. Pure: timestamps are serverTimestamp() sentinels.

const lower = (email: string) => email.trim().toLowerCase();

/** A new pending club. New clubs start with AI, growth tests and the reference opt-out off. */
export function signupClubDoc(
  input: { name: string; country: string; locale: ClubLocale },
  email: string,
  versionKey: string,
): DocumentData {
  const owner = lower(email);
  return {
    name: input.name.trim(),
    country: input.country.trim().toUpperCase(),
    locale: input.locale,
    ownerEmail: owner,
    aiEnabled: false,
    referenceOptOut: false,
    growthTestsEnabled: false,
    createdAt: serverTimestamp(),
    status: 'pending',
    statusReason: null,
    statusChangedAt: null,
    statusChangedBy: null,
    lastStatusLogId: null,
    ...legalUpdate(versionKey, owner),
    termination: { requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null },
    billing: null,
  };
}

/** The signer's own admin member doc (doc id: the lowercased email). */
export function signupMemberDoc(clubId: string, email: string): DocumentData {
  const e = lower(email);
  return { email: e, clubId, role: 'admin', addedBy: e, addedAt: serverTimestamp() };
}

/** The acceptance record, stored at `acceptances/{a.versionKey}`. */
export function acceptanceDoc(a: Omit<Acceptance, 'acceptedAt'>): DocumentData {
  return { ...a, acceptedAt: serverTimestamp() };
}

/** The club's `legal` field, pointing at the acceptance written in the same batch. */
export function legalUpdate(versionKey: string, email: string): { legal: DocumentData } {
  return { legal: { versionKey, acceptedAt: serverTimestamp(), acceptedBy: lower(email) } };
}
