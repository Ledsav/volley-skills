import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading, authError } = useAuth();

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

  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
