import { useCallback, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { TipId } from './onboardingState';

/**
 * Whether a one-time tip may show, and how to end it. Visibility reads the live onboarding map from the auth context
 * (never the sign-in snapshot), and a local flag makes `dismiss` stick at once, so a pending or rejected write
 * never brings the tip back.
 */
export function useTip(id: TipId): { visible: boolean; dismiss: () => void } {
  const { onboarding, updateOnboarding } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const visible = !!onboarding && onboarding.welcomed && !onboarding.tips.includes(id) && !dismissed;
  const dismiss = useCallback(() => {
    // Only a visible tip can be dismissed: a consumed or not-yet-eligible tip must never write.
    if (!visible) return;
    setDismissed(true);
    void Promise.resolve(updateOnboarding({ kind: 'tip', id })).catch(() => {});
  }, [updateOnboarding, id, visible]);
  return { visible, dismiss };
}
