import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { useT } from '../i18n/I18nProvider';
import { RequireAuth } from './RequireAuth';

function Denied() {
  const t = useT().auth.shared;
  return (
    <AuthShell>
      <p role="alert" className="text-red">{t.noAccess}</p>
    </AuthShell>
  );
}

export function RequireClubAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { access } = useAuth();
  return access?.isClubAdmin ? <>{children}</> : <Denied />;
}
