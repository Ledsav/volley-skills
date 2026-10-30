import { vi } from 'vitest';
import type { User } from 'firebase/auth';
import type { Timestamp } from 'firebase/firestore';
import type { Access } from '../auth/access';
import type { AuthContextValue } from '../auth/AuthContext';
import type { Club } from '../types/club';
import { EMPTY_ONBOARDING } from '../onboarding/onboardingState';

const MEMBER_ACCESS: Access = {
  isClubAdmin: false,
  sections: { exercises: false, trainings: false, guides: false },
};

export const clubAdminAccess: Access = {
  isClubAdmin: true,
  sections: { exercises: true, trainings: true, guides: true },
};

export function testClub(over: Partial<Club> = {}): Club {
  return {
    id: 'club-1',
    name: 'Test Club',
    country: 'BE',
    locale: 'en',
    ownerEmail: 'owner@example.com',
    aiEnabled: true,
    referenceOptOut: false,
    growthTestsEnabled: true,
    createdAt: { seconds: 0, nanoseconds: 0 } as Timestamp,
    status: 'active',
    statusReason: null,
    statusChangedAt: null,
    statusChangedBy: null,
    lastStatusLogId: null,
    legal: null,
    termination: { requestedAt: null, requestedBy: null, effectiveAt: null, retrievalEndsAt: null },
    billing: null,
    ...over,
  };
}

export function authValue(over: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    firebaseUser: { uid: 'u-1', email: 'user@example.com' } as User,
    appUser: { uid: 'u-1', email: 'user@example.com', onboarding: EMPTY_ONBOARDING },
    access: MEMBER_ACCESS,
    loading: false,
    authError: null,
    memberships: [{ clubId: 'club-1', role: 'member', clubName: 'Test Club', status: 'active' }],
    activeClubId: 'club-1',
    club: testClub(),
    role: 'member',
    isPlatformAdmin: false,
    droppedClub: false,
    switchClub: vi.fn(),
    onboarding: EMPTY_ONBOARDING,
    updateOnboarding: vi.fn(),
    ...over,
  };
}
