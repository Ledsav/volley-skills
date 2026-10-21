import type { Timestamp } from 'firebase/firestore';

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
  acceptedAt: Timestamp;
  acceptedBy: string;
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
