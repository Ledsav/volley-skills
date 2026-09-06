import type { DevelopmentPlan } from './developmentPlan';

export type { DevelopmentPlan };

export interface Team {
  id: string;
  name: string;
  club: string;
  ageGroup: string;
  season: string;
  description: string;
  notes: string;
  adminEmails: string[];
  developmentPlan: DevelopmentPlan;
  createdBy: string;
  createdAt: unknown;
}
