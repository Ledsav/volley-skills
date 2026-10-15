// src/awards/shareWarning.ts
const KEY = 'vcb.awards.shareWarned';

/** True until the coach has confirmed the minors' images warning in this browser session. */
export function needsShareWarning(): boolean {
  try { return sessionStorage.getItem(KEY) !== '1'; } catch { return true; }
}

export function markShareWarned(): void {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* warn again next time */ }
}
