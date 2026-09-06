export type ObjectiveStatus = 'Active' | 'In progress' | 'Completed' | 'Not started' | 'Attention';

export interface ShortTermObjective {
  objective: string;
  targetDate: string;
  status: ObjectiveStatus;
  coachComment: string;
}

export interface SeasonObjective {
  objective: string;
  target: string;
  status: ObjectiveStatus;
  coachComment: string;
}

export interface DevelopmentPlan {
  shortTermObjectives: ShortTermObjective[];
  seasonObjectives: SeasonObjective[];
  generalNotes: string;
}
