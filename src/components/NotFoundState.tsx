import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
import { StatusLayout } from './StatusLayout';
import { otherUsableClubs } from '../clubs/activeClub';
import { useT } from '../i18n/I18nProvider';

interface NotFoundStateProps {
  title: string;
  message?: string;
  backTo: string;
  backLabel: string;
  illustration?: ReactNode;
}

/** Firestore answers `permission-denied` for docs you can't read: show "not found" so existence isn't leaked. */
export function isNotFoundError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  return code === 'permission-denied' || code === 'not-found';
}

export function NotFoundState({ title, message, backTo, backLabel, illustration }: NotFoundStateProps) {
  const t = useT().components.notFound;
  const { memberships, activeClubId, switchClub } = useAuth();
  const otherClubs = otherUsableClubs(memberships, activeClubId);
  return (
    <div className="w-full px-4 py-16">
      <StatusLayout
        icon={SearchX}
        illustration={illustration}
        title={title}
        actions={
          <Link to={backTo} className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-on-ink font-semibold">
            {backLabel}
          </Link>
        }
      >
        {message && <p>{message}</p>}
        {otherClubs.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <p>{t.otherClub}</p>
            {otherClubs.map((m) => (
              <Button key={m.clubId} variant="secondary" size="sm" onClick={() => switchClub(m.clubId)}>
                {t.switchTo(m.clubName)}
              </Button>
            ))}
          </div>
        )}
      </StatusLayout>
    </div>
  );
}
