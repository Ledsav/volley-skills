import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { useT } from '../i18n/I18nProvider';
import { RequireSignedIn } from './RequireAuth';

function Denied() {
  const t = useT().auth.shared;
  return (
    <AuthShell>
      <p role="alert" className="text-red">{t.noAccess}</p>
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
