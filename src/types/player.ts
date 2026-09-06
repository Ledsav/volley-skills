export interface Guardian {
  relation: 'mother' | 'father' | 'other';
  name: string;
  phone: string;
  email: string;
}

export interface DevelopmentPlanObjective {
  objective: string;
  targetDate: string;
  status: string;
  coachComment: string;
}

export interface DevelopmentPlan {
  shortTermObjectives: DevelopmentPlanObjective[];
  seasonObjectives: DevelopmentPlanObjective[];
  generalNotes: string;
}

export type SkillKey = 'serve' | 'attack' | 'set' | 'defence' | 'reception' | 'jump' | 'speed' | 'iq';

export interface SkillEntry {
  score: number | null;
  notes: string;
  priority: boolean;
}

export type Skills = Record<SkillKey, SkillEntry>;

export type Level = 'Beginner' | 'Developing' | 'Advanced' | 'Elite';

export interface Player {
  id: string;
  number: number;
  fullName: string;
  dob: string;
  nationality: string;
  licenseNumber: string;
  position: string;
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
