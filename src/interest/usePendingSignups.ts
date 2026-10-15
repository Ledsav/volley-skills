import { useEffect, useState } from 'react';
import { countUnreviewedInterestSignups } from './interestApi';
import { SIGNUPS_CHANGED_EVENT } from './signupEvents';

/** Unreviewed access requests, recounted whenever one is reviewed. Always 0 when `enabled` is false. */
export function usePendingSignups(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const recount = () => { void countUnreviewedInterestSignups().then(setCount); };
    recount();
    window.addEventListener(SIGNUPS_CHANGED_EVENT, recount);
    return () => window.removeEventListener(SIGNUPS_CHANGED_EVENT, recount);
  }, [enabled]);

  return enabled ? count : 0;
}
