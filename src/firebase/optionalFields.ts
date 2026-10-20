import { deleteField } from 'firebase/firestore';

/** "Not set" for an optional field is the field being absent — never null or []. */
function isUnset(value: unknown): boolean {
  return value === undefined || value === null || (Array.isArray(value) && value.length === 0);
}

/** Drops the listed optional keys when unset, so a new doc carries only the optional fields that are set. */
export function optionalForCreate<T extends object>(data: T, keys: (keyof T)[]): T {
  const out = { ...data };
  for (const key of keys) {
    if (isUnset(out[key])) delete out[key];
  }
  return out;
}

/** For the listed optional keys that are present but unset, writes deleteField(); other keys pass through. */
export function optionalForUpdate<T extends object>(data: T, keys: (keyof T)[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const key of keys) {
    if (key in data && isUnset(data[key])) out[key as string] = deleteField();
  }
  return out;
}
