import { usePageMeta } from '../layout/usePageMeta';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { LegalLinks } from '../legal/LegalLinks';
import { AuthShell } from '../auth/AuthShell';
import { submitInterestSignup } from './interestApi';
import type { InterestSignupRole } from '../types/interestSignup';
import { useT } from '../i18n/I18nProvider';

const ROLE_KEYS: InterestSignupRole[] = ['coach', 'guardian', 'player', 'other'];

export function RequestAccessPage() {
  const t = useT().interest;
  const tr = t.requestAccess;
  usePageMeta({ title: tr.pageTitle, description: tr.pageDescription, robots: 'index', canonicalPath: '/request-access' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InterestSignupRole>('coach');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitInterestSignup({ name, email, role });
      setSent(true);
    } catch {
      setError(tr.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title={tr.thanks}>
        <p className="text-center text-slate">
          {tr.gotRequest}
        </p>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-blue-strong hover:underline">
            {tr.backToSignIn}
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={tr.heading} navAction={{ to: '/login', label: tr.signIn }}>
      <p className="mb-4 text-center text-sm text-slate">
        {tr.intro}
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
          {tr.name}
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr.namePlaceholder}
          required
          className="mb-4 w-full"
        />

        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          {tr.email}
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tr.emailPlaceholder}
          required
          className="mb-4 w-full"
        />

        <label htmlFor="role" className="mb-1 block text-sm font-medium text-ink">
          {tr.iAm}
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as InterestSignupRole)}
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
        >
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.roles[key]}
            </option>
          ))}
        </select>

        <p className="mb-4 text-xs text-slate">
          {tr.privacyBefore}
          <Link to="/privacy" className="text-blue-strong hover:underline">
            {tr.privacyLink}
          </Link>
          .
        </p>

        <Button type="submit" variant="primary" className="w-full gap-2" disabled={submitting}>
          {tr.submit}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-strong">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-slate hover:underline">
          {tr.alreadyHaveAccess}
        </Link>
      </p>
      <LegalLinks />
    </AuthShell>
  );
}
