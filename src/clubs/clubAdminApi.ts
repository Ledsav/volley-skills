import { serverTimestamp, updateDoc } from 'firebase/firestore';
import { clubDoc } from '../firebase/clubPaths';
import type { ClubLocale } from '../types/club';

export interface ClubProfileInput {
  name: string;
  country: string;
  locale: ClubLocale;
  aiEnabled: boolean;
  referenceOptOut: boolean;
  growthTestsEnabled: boolean;
}

export async function updateClubProfile(input: ClubProfileInput): Promise<void> {
  // Pick the six fields so stray keys can never reach the rules-restricted doc.
  const { name, country, locale, aiEnabled, referenceOptOut, growthTestsEnabled } = input;
  await updateDoc(clubDoc(), { name, country, locale, aiEnabled, referenceOptOut, growthTestsEnabled });
}

export async function transferOwnership(toEmail: string): Promise<void> {
  await updateDoc(clubDoc(), { ownerEmail: toEmail.trim().toLowerCase() });
}

export async function requestTermination(byEmail: string): Promise<void> {
  await updateDoc(clubDoc(), {
    'termination.requestedAt': serverTimestamp(),
    'termination.requestedBy': byEmail.trim().toLowerCase(),
  });
}

const CODES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'CH', 'NO', 'IS', 'US', 'CA', 'MX', 'BR', 'AR',
];
const names = new Intl.DisplayNames(['en'], { type: 'region' });
export const CLUB_COUNTRY_CODES: readonly string[] = [...CODES].sort(
  (a, b) => (names.of(a) ?? a).localeCompare(names.of(b) ?? b),
);
