/**
 * Storage limitation (GDPR Art. 5(1)(e)): a player's data is kept while they
 * are with the club and for one season after they leave, then deleted. The
 * app has no server to delete on a schedule, so admins see who is due and
 * confirm each deletion. The privacy page states the same period.
 */
export const RETENTION_MONTHS = 12;

function shiftMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clamp the day so 31 Jan + 1 month is 28/29 Feb, not 2/3 Mar.
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** The day a player who left on `leftClubAt` is due for deletion. */
export function deletionDueDate(leftClubAt: string): string {
  return shiftMonths(leftClubAt, RETENTION_MONTHS);
}

/** Players who left on or before this date are due for deletion `today`. */
export function deletionCutoff(today: string): string {
  return shiftMonths(today, -RETENTION_MONTHS);
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
