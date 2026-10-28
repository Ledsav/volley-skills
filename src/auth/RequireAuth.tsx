import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ClubGate } from '../clubs/ClubGate';
import { useAuth } from './AuthContext';
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
        <p className="text-slate">{t.loading}</p>
      </AuthShell>
    );
  }

  if (authError) {
    return (
      <AuthShell>
        <p role="alert" className="text-red-strong">
          {t.wentWrong}
          <a href="/login" className="font-medium text-blue-strong hover:underline">
            {t.tryAgain}
          </a>
          .
        </p>
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
