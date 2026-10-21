import { useEffect, useReducer, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ClubStatusScreen } from './ClubStatusScreen';
import { WelcomePage } from './WelcomePage';
import { clubView } from './clubView';
import { nextBoundaryDelay } from './nextBoundary';

/** Decides from the active club's live status and the person's role what they get to see. */
export function ClubGate({ children }: { children: ReactNode }) {
  const { club, role } = useAuth();
  const [tick, forceRender] = useReducer((n: number) => n + 1, 0);
  // Re-render as a contract boundary passes; a clamped timer just fires early and reschedules.
  useEffect(() => {
    const delay = nextBoundaryDelay(club, new Date());
    if (delay === null) return;
    const id = setTimeout(forceRender, delay);
    return () => clearTimeout(id);
  }, [club, tick]);
  const now = new Date();
  switch (clubView(club, role, now)) {
    case 'none':
      return <WelcomePage />;
    case 'pending':
      return <ClubStatusScreen kind="pending" />;
    case 'exportOnly':
      return <ClubStatusScreen kind="exportOnly" />;
    case 'locked': {
      const retrievalEnds = club?.termination.retrievalEndsAt?.toMillis();
      const ended = club?.status === 'terminating' && (retrievalEnds === undefined || now.getTime() >= retrievalEnds);
      return <ClubStatusScreen kind={ended ? 'ended' : 'locked'} />;
    }
    default:
      return <>{children}</>;
  }
}
