import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { AuthShell } from './AuthShell';
import { RequireAuth } from './RequireAuth';
import type { SectionKey } from './access';

export function RequireSection({ section, children }: { section: SectionKey; children: ReactNode }) {
  return (
    <RequireAuth>
      <Gate section={section}>{children}</Gate>
    </RequireAuth>
  );
}

function Gate({ section, children }: { section: SectionKey; children: ReactNode }) {
  const { access } = useAuth();
  if (access?.sections[section]) return <>{children}</>;
  return (
    <AuthShell>
      <p role="alert" className="text-red">You don&apos;t have access to this page.</p>
    </AuthShell>
  );
}
