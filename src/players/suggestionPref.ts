const KEY = 'vcb.skills.suggestions';

/** Whether match-data suggestions show next to skill scores. Per device; defaults to on. */
export function readSuggestionPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeSuggestionPref(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* per-device convenience only */ }
}
