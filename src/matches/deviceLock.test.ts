import { describe, expect, it } from 'vitest';
import { getDeviceId, isLockedByOther, LOCK_STALE_MS } from './deviceLock';

describe('deviceLock', () => {
  it('returns a stable device id', () => {
    expect(getDeviceId()).toBe(getDeviceId());
  });

  it('is locked only by another, recently active device', () => {
    const now = 1_000_000;
    expect(isLockedByOther(null, 'me', now)).toBe(false);
    expect(isLockedByOther({ id: 'me', at: now }, 'me', now)).toBe(false);
    expect(isLockedByOther({ id: 'other', at: now - 1000 }, 'me', now)).toBe(true);
    expect(isLockedByOther({ id: 'other', at: now - LOCK_STALE_MS - 1 }, 'me', now)).toBe(false);
  });
});
