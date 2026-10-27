import { Link } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { usePageMeta } from '../layout/usePageMeta';
import { LegalLinks } from '../legal/LegalLinks';
import { useT } from '../i18n/I18nProvider';

/** /signup: what creating a club involves, before asking anyone to sign in. */
export function SignupInfoPage() {
  const t = useT().signup;
  usePageMeta({
    title: t.shared.createClub,
    description: t.info.description,
    robots: 'index',
    canonicalPath: '/signup',
  });
  return (
    <AuthShell title={t.shared.createClub} navAction={{ to: '/login', label: t.info.signIn }}>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
        <li>{t.info.steps.signIn}</li>
        <li>{t.info.steps.details}</li>
        <li>{t.info.steps.accept}</li>
        <li>{t.info.steps.confirm}</li>
      </ol>
      <p className="mt-3 text-sm text-slate">
        {t.info.manual}
      </p>
      <Link
        to="/signup/club"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        {t.info.start}
      </Link>
      <LegalLinks />
    </AuthShell>
  );
}
