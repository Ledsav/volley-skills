import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { firebaseUser, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
