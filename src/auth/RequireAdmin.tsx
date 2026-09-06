import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireAuth } from './RequireAuth';

function AdminOnly({ children }: { children: ReactNode }) {
  const { appUser } = useAuth();

  if (appUser?.role !== 'admin') {
    return (
      <AuthShell>
        <p role="alert" className="text-red">
          You don&apos;t have access to this page.
        </p>
      </AuthShell>
    );
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminOnly>{children}</AdminOnly>
    </RequireAuth>
  );
}
