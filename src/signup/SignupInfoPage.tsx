import { Link } from 'react-router-dom';
import { AuthShell } from '../auth/AuthShell';
import { usePageMeta } from '../layout/usePageMeta';
import { LegalLinks } from '../legal/LegalLinks';

/** /signup: what creating a club involves, before asking anyone to sign in. */
export function SignupInfoPage() {
  usePageMeta({
    title: 'Create your club',
    description: 'Set up your volleyball club on Volley Skills.',
    robots: 'index',
    canonicalPath: '/signup',
  });
  return (
    <AuthShell title="Create your club" navAction={{ to: '/login', label: 'Sign in' }}>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
        <li>Sign in with your email.</li>
        <li>Enter your club&apos;s details.</li>
        <li>Read and accept the Terms of Service and the Data Processing Agreement.</li>
        <li>Confirm the clauses that need a specific approval through a link we email you.</li>
      </ol>
      <p className="mt-3 text-sm text-slate">
        We activate new clubs by hand, and we&apos;ll email you when yours is ready.
      </p>
      <Link
        to="/signup/club"
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-navy px-4 py-2 font-medium text-white hover:bg-navy/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        Start
      </Link>
      <LegalLinks />
    </AuthShell>
  );
}
