import { Link } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { usePageMeta } from '../layout/usePageMeta';
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
    <AuthShell title={t.shared.createClub} navAction={{ to: '/login', label: t.info.signIn }} legalLinks>
      <ol className="list-decimal space-y-2 pl-5 text-body text-ink">
        <li>{t.info.steps.signIn}</li>
        <li>{t.info.steps.details}</li>
        <li>{t.info.steps.accept}</li>
        <li>{t.info.steps.confirm}</li>
      </ol>
      <p className="text-footnote text-ink-2">
        {t.info.manual}
      </p>
      <Link
        to="/signup/club"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-on-ink font-semibold hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {t.info.start}
      </Link>
    </AuthShell>
  );
}
