import { describe, expect, it } from 'vitest';
import { KEEP_SUBCOLLECTIONS, purgeAllowed, tombstoneOf } from './purge.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T12:00:00Z');
const at = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const terminating = (retrievalEndsMs) => ({
  status: 'terminating',
  termination: { effectiveAt: at(retrievalEndsMs - 30 * DAY), retrievalEndsAt: at(retrievalEndsMs) },
});

describe('purgeAllowed', () => {
  it('allows a terminating club whose retrieval window has ended', () => {
    expect(purgeAllowed(terminating(NOW.getTime() - 1), NOW)).toEqual({ ok: true });
  });

  it('refuses while the retrieval window is open', () => {
    const result = purgeAllowed(terminating(NOW.getTime() + DAY), NOW);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/retrieval window open until 2026-11-21/);
  });

  it('refuses an active club', () => {
    expect(purgeAllowed({ status: 'active' }, NOW)).toEqual({ ok: false, reason: 'club is active' });
  });

  it('allows a deleted club (rejected while pending, or already purged)', () => {
    expect(purgeAllowed({ status: 'deleted' }, NOW)).toEqual({ ok: true });
  });

  it('refuses a missing club', () => {
    expect(purgeAllowed(null, NOW).ok).toBe(false);
  });
});

describe('tombstoneOf', () => {
  it('keeps only the contract evidence', () => {
    const club = {
      name: 'VC', country: 'ES', ownerEmail: 'o@x.com', createdAt: 'C', status: 'terminating',
      aiEnabled: true, termination: {}, billing: null, members: 3,
    };
    const tomb = tombstoneOf(club, 'AT');
    expect(Object.keys(tomb).sort()).toEqual(
      ['name', 'country', 'ownerEmail', 'createdAt', 'status', 'statusChangedAt', 'legal'].sort(),
    );
    expect(tomb).toMatchObject({ status: 'deleted', statusChangedAt: 'AT', legal: null });
  });

  it('keeps acceptances and the status log', () => {
    expect(KEEP_SUBCOLLECTIONS).toEqual(['acceptances', 'statusLog']);
  });
});
