import type { OnboardingState } from '../onboarding/onboardingState';

export interface AppUser {
  uid: string;
  email: string;
  onboarding: OnboardingState;
}
