import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { buttonClassName } from '../components/Button';
import { useT } from '../i18n/I18nProvider';
import { MinimalShell } from '../layout/MinimalShell';

/** The operator's frame: the minimal shell, plus a way back to the app when the operator also belongs to a club. */
export function PlatformShell({ children }: { children: ReactNode }) {
  const t = useT();
  const { memberships } = useAuth();
  const back =
    memberships.length > 0 ? (
      <Link to="/" className={buttonClassName('secondary')}>{t.platform.backToApp}</Link>
    ) : undefined;
  return <MinimalShell title={t.layout.nav.platform} actions={back}>{children}</MinimalShell>;
}
