import { Lock } from 'lucide-react';
import { StatusLayout } from '../components/StatusLayout';
import { useT } from '../i18n/I18nProvider';
import { AuthShell } from './AuthShell';

/** The shared "no access" status: inside the app shell, or framed for routes outside it. */
export function NoAccess({ framed = false }: { framed?: boolean }) {
  const t = useT().auth.shared;
  const status = <StatusLayout role="alert" icon={Lock} title={t.noAccess} />;
  if (framed) return <AuthShell>{status}</AuthShell>;
  return <div className="w-full px-4 py-16">{status}</div>;
}
