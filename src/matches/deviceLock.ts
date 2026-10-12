import type { ActiveDevice } from '../types/match';

const KEY = 'vcb.scoutDeviceId';
export const LOCK_STALE_MS = 2 * 60 * 1000;
let memoryId: string | null = null;

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `dev-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    memoryId ??= newId();
    return memoryId;
  }
}

export function isLockedByOther(active: ActiveDevice | null, myId: string, now: number): boolean {
  return !!active && active.id !== myId && now - active.at < LOCK_STALE_MS;
}
