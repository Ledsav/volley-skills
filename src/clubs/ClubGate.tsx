import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ClubStatusScreen } from './ClubStatusScreen';
import { WelcomePage } from './WelcomePage';
import { clubView } from './clubView';

/** Decides from the active club's live status and the person's role what they get to see. */
export function ClubGate({ children }: { children: ReactNode }) {
  const { club, role } = useAuth();
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
