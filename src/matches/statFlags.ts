/**
 * When a number is bad enough to colour red. One source for the live stats
 * panel, the post-match report and the team stats table, so a value flagged
 * during the match reads the same way afterwards.
 */
export const WEAK_RECEPTION_POS = 0.4;
/** Per-match error count; a season total isn't comparable, so season views skip it. */
export const MANY_ERRORS_PER_MATCH = 3;

export const WEAK_CLASS = 'font-semibold text-red-strong';

export function isWeakReception(pos: number | null): boolean {
  return pos !== null && pos < WEAK_RECEPTION_POS;
}

export function isWeakAttack(eff: number | null): boolean {
  return eff !== null && eff < 0;
}

export function isManyErrors(errorsInMatch: number): boolean {
  return errorsInMatch >= MANY_ERRORS_PER_MATCH;
}

/** `WEAK_CLASS` when `weak`, else ''. */
export function weakClass(weak: boolean): string {
  return weak ? WEAK_CLASS : '';
}
