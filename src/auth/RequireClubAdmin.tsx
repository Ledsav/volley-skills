import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { NoAccess } from './NoAccess';
import { RequireAuth } from './RequireAuth';

export function RequireClubAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  return access?.isClubAdmin ? <>{children}</> : <NoAccess />;
}
