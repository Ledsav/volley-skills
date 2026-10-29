import { useEffect, useReducer, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ClubStatusScreen } from './ClubStatusScreen';
import { WelcomePage } from './WelcomePage';
import { clubView } from './clubView';
import { MinimalShell } from '../layout/MinimalShell';
import { ClubAreaPage } from './area/ClubAreaPage';
import { nextBoundaryDelay } from './nextBoundary';
import { LegalReviewScreen } from '../legal/LegalReviewScreen';
import { needsReview } from '../legal/versions';
import { useT } from '../i18n/I18nProvider';

/** Decides from the active club's live status and the person's role what they get to see. */
export function ClubGate({ children }: { children: ReactNode }) {
  const { club, role } = useAuth();
  const t = useT().clubs;
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
      return (
        <MinimalShell title={club?.name ?? t.clubFallback}>
          <ClubAreaPage restricted />
        </MinimalShell>
      );
    case 'locked': {
      const retrievalEnds = club?.termination.retrievalEndsAt?.toMillis();
      const ended = club?.status === 'terminating' && (retrievalEnds === undefined || now.getTime() >= retrievalEnds);
      return <ClubStatusScreen kind={ended ? 'ended' : 'locked'} />;
    }
    default: {
      if (role === 'admin' && needsReview(club?.legal ?? null, now)) {
        // The club chose to end the contract instead: it keeps full use under the terms it accepted.
        if (club?.termination?.requestedAt) {
          return (
            <>
              <div role="status" className="border-b border-separator bg-orange-tint px-4 py-2.5 text-footnote text-ink">
                {t.gate.contractEndedInstead}
              </div>
              {children}
            </>
          );
        }
        return <LegalReviewScreen />;
      }
      return <>{children}</>;
    }
  }
}
