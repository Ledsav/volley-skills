import type { DevelopmentPlan } from './developmentPlan';
import type { PhysicalTest, PhysicalTestType } from './physicalTest';

/** Newest test per type, denormalized onto the player doc so the card needs no
 *  per-type queries. Missing on players whose tests predate it. */
export type LatestTests = Partial<Record<PhysicalTestType, PhysicalTest>>;

export type { DevelopmentPlan };

export interface Guardian {
  relation: 'mother' | 'father' | 'other';
  name: string;
  phone: string;
  email: string;
}

export type SkillKey =
  | 'serve'
  | 'attack'
  | 'block'
  | 'set'
  | 'defence'
  | 'reception'
  | 'jump'
  | 'speed'
  | 'iq';

export const SKILL_KEYS: readonly SkillKey[] = [
  'serve', 'attack', 'block', 'set', 'defence', 'reception', 'jump', 'speed', 'iq',
];

export interface SkillEntry {
  score: number | null;
  notes: string;
  priority: boolean;
}

export type Skills = Record<SkillKey, SkillEntry>;

export type Level = 'Beginner' | 'Developing' | 'Advanced' | 'Elite';

/**
 * Structured on-court role, used to order a roster into a lineup. Lineup order
 * (see rosterSort.ts) is setter, outside, opposite, middle, libero, then
 * unassigned, with "universal" (an all-round player with no fixed position)
 * sorted dead last.
 */
export type PositionCategory = 'S' | 'OH' | 'O' | 'MB' | 'L' | 'U' | 'TBD';

/** Position codes in display order; their labels live in the catalog (`labels.position`). */
export const POSITION_CATEGORIES: { value: PositionCategory }[] = [
  { value: 'S' },
  { value: 'OH' },
  { value: 'O' },
  { value: 'MB' },
  { value: 'L' },
  { value: 'U' },
  { value: 'TBD' },
];

/** Kit size. '' = not recorded yet (also the value for docs that predate the field). */
export type ShirtSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';

export const SHIRT_SIZES: ShirtSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

export interface Player {
  id: string;
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  positionCategory: PositionCategory;
  shirtSize: ShirtSize | '';
  starting: boolean;
  playerPhone: string;
  guardians: Guardian[];
  viewerEmails: string[];
  teamName: string;
  ageGroup: string;
  season: string;
  skills: Skills;
  avgScore: number | null;
  level: Level | null;
  developmentPlan: DevelopmentPlan;
  latestTests?: LatestTests;
  consent: { given: boolean; date: string | null; confirmedBy: string | null };
  /** Guardian consent to use a minor's photo in award cards. Adults need no toggle; absent = not given. */
  photoConsent?: boolean;
  photoConsentAt?: unknown;
  photoConsentBy?: string | null;
  /** "YYYY-MM-DD" the player left the club; null/absent while still a member. Starts the retention clock. */
  leftClubAt?: string | null;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}
