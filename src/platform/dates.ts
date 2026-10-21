export const DAY_MS = 86_400_000;
export const RETRIEVAL_MIN_MS = 30 * DAY_MS;

function parts(isoDate: string): [number, number, number] {
  const [y, m, d] = isoDate.split('-').map(Number);
  return [y, m - 1, d];
}

export function startOfLocalDay(isoDate: string): Date {
  const [y, m, d] = parts(isoDate);
  return new Date(y, m, d, 0, 0, 0, 0);
}

export function endOfLocalDay(isoDate: string): Date {
  const [y, m, d] = parts(isoDate);
  return new Date(y, m, d, 23, 59, 59, 999);
}

export function retrievalLongEnough(effectiveAt: Date, retrievalEndsAt: Date): boolean {
  return retrievalEndsAt.getTime() - effectiveAt.getTime() >= RETRIEVAL_MIN_MS;
}
