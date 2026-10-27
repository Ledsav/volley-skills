import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/I18nProvider';
import { usePageMeta } from './usePageMeta';

function OutOfBounds() {
  return (
    <svg viewBox="0 0 160 100" className="h-28 w-44" aria-hidden="true">
      <rect x="10" y="20" width="110" height="70" rx="4" className="fill-none stroke-border" strokeWidth="3" />
      <line x1="65" y1="20" x2="65" y2="90" className="stroke-border" strokeWidth="3" />
      <circle cx="138" cy="34" r="14" className="fill-orange" />
      <path d="M126 30c8 2 16 2 24 0M128 42c6-6 14-8 20-6" className="fill-none stroke-white" strokeWidth="2" />
      <path d="M100 70 Q120 30 132 40" className="fill-none stroke-slate" strokeDasharray="4 4" strokeWidth="2" />
    </svg>
  );
}

export function NotFoundPage() {
  const c = useT().common;
  const t = useT().layout.notFound;
  usePageMeta({ title: t.title });
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const canGoBack = typeof window !== 'undefined' && window.history.length > 1;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <OutOfBounds />
      <h1 tabIndex={-1} className="mt-4 text-title font-semibold text-ink">{t.heading}</h1>
      <p className="mt-2 text-slate">
        {t.nothingLivesAt}<code className="rounded-sm bg-bg px-1 text-ink">{pathname}</code>
      </p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-md bg-blue px-4 font-medium text-white hover:bg-blue-strong">
          {t.goHome}
        </Link>
        <button
          type="button"
          onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
          className="inline-flex min-h-11 items-center rounded-md border border-border px-4 font-medium text-ink hover:bg-bg"
        >
          {c.back}
        </button>
      </div>
    </div>
  );
}
