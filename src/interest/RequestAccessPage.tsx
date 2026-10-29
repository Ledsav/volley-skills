import { usePageMeta } from '../layout/usePageMeta';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/Button';
import { FIELD_CLASS, Input } from '../components/Input';
import { StatusLayout } from '../components/StatusLayout';
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
      <AuthShell>
        <StatusLayout
          icon={CheckCircle2}
          title={tr.thanks}
          actions={
            <Link to="/login" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink text-on-ink font-semibold">
              {tr.backToSignIn}
            </Link>
          }
        >
          {tr.gotRequest}
        </StatusLayout>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={tr.heading} navAction={{ to: '/login', label: tr.signIn }} legalLinks>
      <p className="text-body text-ink-2">{tr.intro}</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name" className="mb-1.5 block text-footnote font-medium text-ink-2">
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

        <label htmlFor="email" className="mb-1.5 block text-footnote font-medium text-ink-2">
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

        <label htmlFor="role" className="mb-1.5 block text-footnote font-medium text-ink-2">
          {tr.iAm}
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as InterestSignupRole)}
          className={`${FIELD_CLASS} mb-4 w-full`}
        >
          {ROLE_KEYS.map((key) => (
            <option key={key} value={key}>
              {t.roles[key]}
            </option>
          ))}
        </select>

        <p className="mb-4 text-footnote text-ink-2">
          {tr.privacyBefore}
          <Link to="/privacy" className="text-ink underline">
            {tr.privacyLink}
          </Link>
          .
        </p>

        <Button type="submit" variant="primary" className="min-h-12 w-full gap-2" disabled={submitting}>
          {tr.submit}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-footnote text-red-strong">
          {error}
        </p>
      )}

      <p className="text-center text-callout text-ink-2">
        <Link to="/login" className="font-semibold text-ink hover:underline">
          {tr.alreadyHaveAccess}
        </Link>
      </p>
    </AuthShell>
  );
}
