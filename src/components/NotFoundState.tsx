import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Button } from './Button';
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
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {illustration ?? <SearchX size={48} strokeWidth={1.5} className="text-slate" aria-hidden="true" />}
      <h1 tabIndex={-1} className="mt-4 text-title font-semibold text-ink">{title}</h1>
      {message && <p className="mt-2 text-slate">{message}</p>}
      {otherClubs.length > 0 && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-slate">{t.otherClub}</p>
          {otherClubs.map((m) => (
            <Button key={m.clubId} variant="secondary" size="sm" onClick={() => switchClub(m.clubId)}>
              {t.switchTo(m.clubName)}
            </Button>
          ))}
        </div>
      )}
      <Link to={backTo} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-blue-strong px-4 font-medium text-on-ink hover:opacity-90">
        {backLabel}
      </Link>
    </div>
  );
}
