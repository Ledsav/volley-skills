import type { DevelopmentPlan } from './developmentPlan';

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

export const SKILL_KEYS: SkillKey[] = [
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

export const POSITION_CATEGORIES: { value: PositionCategory; label: string }[] = [
  { value: 'S', label: 'Setter' },
  { value: 'OH', label: 'Outside' },
  { value: 'O', label: 'Opposite' },
  { value: 'MB', label: 'Middle' },
  { value: 'L', label: 'Libero' },
  { value: 'U', label: 'Universal' },
  { value: 'TBD', label: 'TBD' },
];

export interface Player {
  id: string;
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  positionCategory: PositionCategory;
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
  consent: { given: boolean; date: string | null; confirmedBy: string | null };
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}
