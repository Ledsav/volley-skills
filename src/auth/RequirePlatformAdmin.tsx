import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { NoAccess } from './NoAccess';
import { RequireSignedIn } from './RequireAuth';

/** Signed in as the platform operator; needs no club membership. */
export function RequirePlatformAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireSignedIn>
      <Gate>{children}</Gate>
    </RequireSignedIn>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { isPlatformAdmin } = useAuth();
  return isPlatformAdmin ? <>{children}</> : <NoAccess framed />;
}
