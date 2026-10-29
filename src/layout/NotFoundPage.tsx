import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { StatusLayout } from '../components/StatusLayout';
import { useT } from '../i18n/I18nProvider';
import { usePageMeta } from './usePageMeta';

function OutOfBounds() {
  return (
    <svg viewBox="0 0 160 100" className="h-28 w-44" aria-hidden="true">
      <rect x="10" y="20" width="110" height="70" rx="4" className="fill-none stroke-ink-3" strokeWidth="3" />
      <line x1="65" y1="20" x2="65" y2="90" className="stroke-ink-3" strokeWidth="3" />
      <circle cx="138" cy="34" r="14" className="fill-ink" />
      <path d="M126 30c8 2 16 2 24 0M128 42c6-6 14-8 20-6" className="fill-none stroke-bg" strokeWidth="2" />
      <path d="M100 70 Q120 30 132 40" className="fill-none stroke-ink-2" strokeDasharray="4 4" strokeWidth="2" />
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
    <div className="w-full px-4 py-16">
      <StatusLayout
        illustration={<OutOfBounds />}
        title={t.heading}
        actions={
          <>
            <Link to="/" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-on-ink font-semibold">
              {t.goHome}
            </Link>
            <Button
              variant="secondary"
              className="min-h-12 w-full rounded-full"
              onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
            >
              {c.back}
            </Button>
          </>
        }
      >
        {t.nothingLivesAt}
        <code className="rounded-sm bg-surface-2 px-1 text-ink">{pathname}</code>
      </StatusLayout>
    </div>
  );
}
