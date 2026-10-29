import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ClubGate } from '../clubs/ClubGate';
import { useAuth } from './AuthContext';
import { AlertTriangle } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';
import { AuthShell } from './AuthShell';
import { rememberReturnTo } from './returnTo';
import { useT } from '../i18n/I18nProvider';

/** Signed in, whatever the club: loading, sign-in errors and the redirect to /login. */
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, authError } = useAuth();
  const location = useLocation();
  const t = useT().auth.requireAuth;

  if (loading) {
    return (
      <AuthShell>
        <StatusLayout role="status">{t.loading}</StatusLayout>
      </AuthShell>
    );
  }

  if (authError) {
    return (
      <AuthShell>
        <StatusLayout role="alert" tone="error" icon={AlertTriangle}>
          {t.wentWrong}
          <a href="/login" className="font-semibold text-ink underline">
            {t.tryAgain}
          </a>
          .
        </StatusLayout>
      </AuthShell>
    );
  }

  if (!firebaseUser) {
    rememberReturnTo(`${location.pathname}${location.search}`);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return (
    <RequireSignedIn>
      <ClubGate>{children}</ClubGate>
    </RequireSignedIn>
  );
}
