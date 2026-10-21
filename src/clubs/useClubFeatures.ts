import { useAuth } from '../auth/AuthContext';

export interface ClubFeatures {
  aiEnabled: boolean;
  growthTestsEnabled: boolean;
}

/** Feature switches the active club controls; everything is off without a club. */
export function useClubFeatures(): ClubFeatures {
  const { club } = useAuth();
  return { aiEnabled: !!club?.aiEnabled, growthTestsEnabled: !!club?.growthTestsEnabled };
}
