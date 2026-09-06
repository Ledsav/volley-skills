import { useState, type FormEvent } from 'react';
import { sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AuthShell } from './AuthShell';
import { saveEmailForSignIn } from './emailLinkStorage';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/finish-sign-in`,
        handleCodeInApp: true,
      });
      saveEmailForSignIn(email);
      setSent(true);
    } catch {
      setError('Could not send sign-in link. Please check the email address and try again.');
    }
  }

  if (sent) {
    return (
      <AuthShell title="Volley Skills">
        <p className="text-slate">Check your email for a sign-in link.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Volley Skills">
      <form onSubmit={handleSubmit}>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
          Email
        </label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 w-full"
        />
        <Button type="submit" variant="primary" className="w-full">
          Send sign-in link
        </Button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red">
            {error}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
