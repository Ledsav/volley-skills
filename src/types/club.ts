import type { Timestamp } from 'firebase/firestore';
import type { LegalLang } from '../legal/versions';

export type ClubStatus = 'pending' | 'active' | 'suspended' | 'terminating' | 'deleted';
export type MemberRole = 'admin' | 'member';
export type ClubLocale = 'en' | 'it';

export interface ClubTermination {
  requestedAt: Timestamp | null;
  requestedBy: string | null;
  effectiveAt: Timestamp | null;
  retrievalEndsAt: Timestamp | null;
}

export interface ClubLegal {
  versionKey: string;
  /** Null while a serverTimestamp() write is still pending locally. */
  acceptedAt: Timestamp | null;
  acceptedBy: string;
}

/** What a club admin signed: versions, language, hashes of the exact texts shown, and the re-auth evidence. */
export interface Acceptance {
  versionKey: string;
  termsVersion: string;
  dpaVersion: string;
  subprocessorsVersion: string;
  language: LegalLang;
  termsSha256: string;
  dpaSha256: string;
  clausesSha256: string;
  specificClauses: string[];
  acceptedBy: string;
  acceptedByName: string;
  authorityConfirmed: true;
  acceptedAt: Timestamp | null;
  authTime: number;
  userAgent: string;
}

export interface Club {
  id: string;
  name: string;
  country: string;
  locale: ClubLocale;
  ownerEmail: string;
  aiEnabled: boolean;
  referenceOptOut: boolean;
  growthTestsEnabled: boolean;
  createdAt: Timestamp;
  status: ClubStatus;
  statusReason: string | null;
  statusChangedAt: Timestamp | null;
  statusChangedBy: string | null;
  lastStatusLogId: string | null;
  legal: ClubLegal | null;
  termination: ClubTermination;
  billing: null;
}

export interface Member {
  email: string;
  clubId: string;
  role: MemberRole;
  addedBy: string;
  addedAt: Timestamp;
}

export interface Membership {
  clubId: string;
  role: MemberRole;
  clubName: string;
  status: ClubStatus;
}
