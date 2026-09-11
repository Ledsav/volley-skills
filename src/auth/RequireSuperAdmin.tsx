import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireAuth } from './RequireAuth';

function Denied() {
  return (
    <AuthShell>
      <p role="alert" className="text-red">You don&apos;t have access to this page.</p>
    </AuthShell>
  );
}

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  return access?.isSuperAdmin ? <>{children}</> : <Denied />;
}
