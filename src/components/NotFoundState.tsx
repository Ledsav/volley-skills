import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

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
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {illustration ?? <SearchX size={48} strokeWidth={1.5} className="text-slate" aria-hidden="true" />}
      <h1 tabIndex={-1} className="mt-4 text-title font-semibold text-ink">{title}</h1>
      {message && <p className="mt-2 text-slate">{message}</p>}
      <Link to={backTo} className="mt-6 inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
        {backLabel}
      </Link>
    </div>
  );
}
