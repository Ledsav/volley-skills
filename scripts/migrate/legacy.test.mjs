import { describe, expect, it } from 'vitest';
import { DROP_COLLECTIONS, dropAllowed, GRACE_DAYS } from './legacy.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T12:00:00Z');
const createdDaysAgo = (days) => ({ createdAt: { toMillis: () => NOW.getTime() - days * DAY } });

describe('dropAllowed', () => {
  it('allows the drop after the grace period', () => {
    expect(GRACE_DAYS).toBe(14);
    expect(dropAllowed(createdDaysAgo(15), NOW)).toEqual({ ok: true });
  });

  it('refuses during the grace period', () => {
    const result = dropAllowed(createdDaysAgo(13), NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/grace period runs until 20/);
  });

  it('refuses before the migration', () => {
    expect(dropAllowed(null, NOW)).toMatchObject({ ok: false, reason: expect.stringMatching(/migrate first/) });
  });

  it('never drops users, leads, operators or clubs', () => {
    for (const kept of ['users', 'interestSignups', 'platformAdmins', 'clubs']) expect(DROP_COLLECTIONS).not.toContain(kept);
  });
});
