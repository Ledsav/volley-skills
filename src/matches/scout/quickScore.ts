const QUICK_SCORE_KEY = 'vcb.scout.quickScore';

/** Per-device preference, default off. Storage can throw (private mode, blocked site data). */
export function readQuickScore(): boolean {
  try {
    return window.localStorage.getItem(QUICK_SCORE_KEY) === 'on';
  } catch {
    return false;
  }
}

export function writeQuickScore(on: boolean): void {
  try {
    window.localStorage.setItem(QUICK_SCORE_KEY, on ? 'on' : 'off');
  } catch {
    // Not persisted; the toggle still applies for this visit.
  }
}
