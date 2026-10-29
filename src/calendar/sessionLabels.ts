import type { CalendarSession } from '../types/calendarSession';

export function sessionLabel(session: CalendarSession): string {
  return `${session.trainingBusinessId} · ${session.trainingName}`;
}

/** Opens the session's training with its team context, so the PDF export can add team notes. */
export function sessionLink(teamId: string, session: CalendarSession): string {
  const params = new URLSearchParams({ businessId: session.trainingBusinessId, team: teamId, session: session.id });
  return `/trainings?${params}`;
}
