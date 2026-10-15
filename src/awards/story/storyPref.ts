// src/awards/story/storyPref.ts
const KEY = 'vcb.awards.story';

/** Whether the presentation opens with the season/match story. Defaults to on. */
export function readStoryPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

export function writeStoryPref(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* per-device convenience only */ }
}
