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
