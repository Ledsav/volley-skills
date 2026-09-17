import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AuthShell } from '../auth/AuthShell';
import { submitInterestSignup } from './interestApi';
import type { InterestSignupRole } from '../types/interestSignup';

const ROLE_OPTIONS: { key: InterestSignupRole; label: string }[] = [
  { key: 'coach', label: 'Coach' },
  { key: 'guardian', label: 'Guardian' },
  { key: 'player', label: 'Player' },
  { key: 'other', label: 'Other' },
];

export function RequestAccessPage() {
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
      setError('Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthShell title="Thanks!">
        <p className="text-center text-slate">
          We&apos;ve got your request and will be in touch about early access.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-blue hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Let's get you set up" navAction={{ to: '/login', label: 'Sign in' }}>
      <p className="mb-4 text-center text-sm text-slate">
        Tell us a bit about you and we&apos;ll reach out when your access is ready.
      </p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-ink">
          Name
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jamie Smith"
          required
          className="mb-4 w-full"
        />

        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="mb-4 w-full"
        />

        <label htmlFor="role" className="mb-1 block text-sm font-medium text-ink">
          I am a...
        </label>
        <select
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value as InterestSignupRole)}
          className="mb-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-ink focus:outline-none focus:ring-2 focus:ring-blue"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>

        <Button type="submit" variant="primary" className="w-full gap-2" disabled={submitting}>
          Request access
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-slate hover:underline">
          Already have access? Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
