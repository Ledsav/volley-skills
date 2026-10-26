import { describe, expect, it } from 'vitest';
import type { ClubStatus } from '../types/club';
import { clubActions, defaultTerminationDates } from './clubActions';
import { DAY_MS } from './dates';

const offered = (status: ClubStatus) =>
  clubActions({ status }).map((a) => [a.kind, a.label, a.to, a.reasonRequired, a.needsDates, a.secondary]);

describe('clubActions', () => {
  it('pending offers activate and reject', () => {
    expect(offered('pending')).toEqual([
      ['activate', 'Activate', 'active', false, false, false],
      ['reject', 'Reject', 'deleted', false, false, true],
    ]);
  });
  it('active offers deactivate (reason required) and end contract', () => {
    expect(offered('active')).toEqual([
      ['deactivate', 'Deactivate', 'suspended', true, false, false],
      ['endContract', 'End contract', 'terminating', false, true, true],
    ]);
  });
  it('suspended offers activate and end contract', () => {
    expect(offered('suspended')).toEqual([
      ['activate', 'Activate', 'active', false, false, false],
      ['endContract', 'End contract', 'terminating', false, true, true],
    ]);
  });
  it('terminating offers reinstate (dates are cleared by changeClubStatus) and change dates', () => {
    expect(offered('terminating')).toEqual([
      ['reinstate', 'Reinstate', 'active', false, false, false],
      ['changeDates', 'Change dates', 'terminating', false, true, true],
    ]);
  });
  it('deleted offers nothing', () => {
    expect(offered('deleted')).toEqual([]);
  });

  it('defaultTerminationDates gives effectiveAt now+30 days and retrievalEndsAt effectiveAt+30 days', () => {
    const now = new Date(2027, 0, 10, 12);
    const { effectiveAt, retrievalEndsAt } = defaultTerminationDates(now);
    expect(effectiveAt.getTime()).toBe(now.getTime() + 30 * DAY_MS);
    expect(retrievalEndsAt.getTime()).toBe(effectiveAt.getTime() + 30 * DAY_MS);
  });

  it('defaultTerminationDates ends a paused club today', () => {
    const now = new Date(2027, 0, 10, 12);
    const { effectiveAt, retrievalEndsAt } = defaultTerminationDates(now, 'suspended');
    expect(effectiveAt.getTime()).toBe(now.getTime());
    expect(retrievalEndsAt.getTime()).toBe(now.getTime() + 30 * DAY_MS);
    expect(defaultTerminationDates(now, 'active').effectiveAt.getTime()).toBe(now.getTime() + 30 * DAY_MS);
  });
});
