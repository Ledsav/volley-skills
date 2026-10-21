import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ClubGate } from '../clubs/ClubGate';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { rememberReturnTo } from './returnTo';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, authError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <AuthShell>
        <p className="text-slate">Loading...</p>
      </AuthShell>
    );
  }

  if (authError) {
    return (
      <AuthShell>
        <p role="alert" className="text-red">
          Something went wrong signing you in.{' '}
          <a href="/login" className="font-medium text-blue hover:underline">
            Try again
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
  return <ClubGate>{children}</ClubGate>;
}
