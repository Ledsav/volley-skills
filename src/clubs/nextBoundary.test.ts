import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { testClub } from '../test/authValue';
import { MAX_TIMER_MS, nextBoundaryDelay } from './nextBoundary';

const EFFECTIVE = new Date('2026-12-01T00:00:00Z');
const RETRIEVAL = new Date('2027-01-01T00:00:00Z');
const DAY = 86_400_000;

function terminating(effective = EFFECTIVE, retrieval = RETRIEVAL) {
  return testClub({
    status: 'terminating',
    termination: {
      requestedAt: null,
      requestedBy: null,
      effectiveAt: Timestamp.fromDate(effective),
      retrievalEndsAt: Timestamp.fromDate(retrieval),
    },
  });
}

describe('nextBoundaryDelay', () => {
  it('returns ms to effectiveAt while before it', () => {
    const now = new Date(EFFECTIVE.getTime() - 5000);
    expect(nextBoundaryDelay(terminating(), now)).toBe(5000);
  });

  it('returns ms to retrievalEndsAt between the two', () => {
    expect(nextBoundaryDelay(terminating(), new Date(EFFECTIVE.getTime() + 10 * DAY))).toBe(RETRIEVAL.getTime() - EFFECTIVE.getTime() - 10 * DAY);
    const now = new Date(RETRIEVAL.getTime() - 1234);
    expect(nextBoundaryDelay(terminating(), now)).toBe(1234);
  });

  it('returns null after retrievalEndsAt or for a non-terminating club', () => {
    expect(nextBoundaryDelay(terminating(), RETRIEVAL)).toBeNull();
    expect(nextBoundaryDelay(terminating(), new Date('2027-02-01'))).toBeNull();
    expect(nextBoundaryDelay(null, EFFECTIVE)).toBeNull();
    expect(nextBoundaryDelay(testClub({ status: 'active' }), EFFECTIVE)).toBeNull();
    expect(nextBoundaryDelay(testClub({ status: 'suspended' }), EFFECTIVE)).toBeNull();
    expect(nextBoundaryDelay(testClub({ status: 'terminating' }), EFFECTIVE)).toBeNull();
  });

  it('clamps a boundary 60 days away to MAX_TIMER_MS', () => {
    expect(MAX_TIMER_MS).toBe(2_147_483_647);
    const now = new Date(EFFECTIVE.getTime() - 60 * DAY);
    expect(nextBoundaryDelay(terminating(), now)).toBe(MAX_TIMER_MS);
  });
});
