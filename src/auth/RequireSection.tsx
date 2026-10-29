import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { NoAccess } from './NoAccess';
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
  return <NoAccess />;
}
