export interface CalendarSession {
  id: string;
  date: string;
  trainingId: string;
  trainingBusinessId: string;
  trainingName: string;
  notes: string;
  createdBy: string;
  createdAt: unknown;
}

export interface NewCalendarSessionInput {
  date: string;
  trainingId: string;
  trainingBusinessId: string;
  trainingName: string;
  notes: string;
}
