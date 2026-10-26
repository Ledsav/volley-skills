import type { Club } from '../types/club';

/** setTimeout's largest delay; anything above it fires immediately. */
export const MAX_TIMER_MS = 2_147_483_647;

/** Ms until the next contract boundary of a terminating club still ahead, clamped for setTimeout. */
export function nextBoundaryDelay(club: Club | null, now: Date): number | null {
  if (club?.status !== 'terminating') return null;
  const t = now.getTime();
  const next = [club.termination.effectiveAt, club.termination.retrievalEndsAt]
    .map((ts) => ts?.toMillis())
    .find((ms): ms is number => ms !== undefined && ms > t);
  return next === undefined ? null : Math.min(next - t, MAX_TIMER_MS);
}
