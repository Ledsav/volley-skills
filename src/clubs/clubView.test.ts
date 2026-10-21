import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import { testClub } from '../test/authValue';
import type { ClubStatus, MemberRole } from '../types/club';
import { clubView, type ClubView } from './clubView';

const EFFECTIVE = new Date('2026-12-01T00:00:00Z');
const RETRIEVAL = new Date('2027-01-01T00:00:00Z');
const at = (iso: string) => new Date(iso);

function club(status: ClubStatus) {
  return testClub({
    status,
    termination: {
      requestedAt: null,
      requestedBy: null,
      effectiveAt: Timestamp.fromDate(EFFECTIVE),
      retrievalEndsAt: Timestamp.fromDate(RETRIEVAL),
    },
  });
}

describe('clubView', () => {
  it.each<[string, ClubStatus | null, MemberRole | null, Date, ClubView]>([
    ['no club', null, null, at('2026-11-01'), 'none'],
    ['deleted', 'deleted', 'admin', at('2026-11-01'), 'none'],
    ['pending', 'pending', 'admin', at('2026-11-01'), 'pending'],
    ['active', 'active', 'member', at('2026-11-01'), 'app'],
    ['suspended admin', 'suspended', 'admin', at('2026-11-01'), 'exportOnly'],
    ['suspended member', 'suspended', 'member', at('2026-11-01'), 'locked'],
    ['terminating before effective', 'terminating', 'member', at('2026-11-30T23:59:59Z'), 'ending'],
    ['at effectiveAt, admin', 'terminating', 'admin', EFFECTIVE, 'exportOnly'],
    ['at effectiveAt, member', 'terminating', 'member', EFFECTIVE, 'locked'],
    ['retrieval window, admin', 'terminating', 'admin', at('2026-12-15'), 'exportOnly'],
    ['retrieval window, member', 'terminating', 'member', at('2026-12-15'), 'locked'],
    ['at retrievalEndsAt, admin', 'terminating', 'admin', RETRIEVAL, 'locked'],
    ['at retrievalEndsAt, member', 'terminating', 'member', RETRIEVAL, 'locked'],
    ['after retrieval, admin', 'terminating', 'admin', at('2027-02-01'), 'locked'],
  ])('%s', (_name, status, role, now, expected) => {
    expect(clubView(status ? club(status) : null, role, now)).toBe(expected);
  });
});
