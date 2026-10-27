import type { Gender } from '../i18n/catalog';
import type { DevelopmentPlan } from './developmentPlan';

export type { DevelopmentPlan };

export interface Team {
  id: string;
  name: string;
  ageGroup: string;
  season: string;
  description: string;
  notes: string;
  /** Absent on teams created before gender existed; read it through teamGender(). */
  gender?: Gender;
  adminEmails: string[];
  developmentPlan: DevelopmentPlan;
  createdBy: string;
  createdAt: unknown;
  activeTestingSessionId?: string | null;
}
