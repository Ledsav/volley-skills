import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireSignedIn } from './RequireAuth';

function Denied() {
  return (
    <AuthShell>
      <p role="alert" className="text-red">You don&apos;t have access to this page.</p>
    </AuthShell>
  );
}

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
  return isPlatformAdmin ? <>{children}</> : <Denied />;
}
