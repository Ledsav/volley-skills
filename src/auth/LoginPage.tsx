import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, sendSignInLinkToEmail, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { AuthShell } from './AuthShell';
import { saveEmailForSignIn } from './emailLinkStorage';

const googleProvider = new GoogleAuthProvider();

export function LoginPage() {
  const navigate = useNavigate();
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

  async function handleGoogleSignIn() {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/teams', { replace: true });
    } catch {
      setError('Could not sign in with Google. Please try again.');
    }
  }

  if (sent) {
    return (
      <AuthShell title="Volley Skills">
        <p className="text-slate">Check your email for a sign-in link.</p>
        <p className="mt-6 text-sm">
          <Link to="/privacy" className="text-slate hover:underline">
            Privacy
          </Link>
        </p>
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
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-slate">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" className="w-full" onClick={handleGoogleSignIn}>
        Continue with Google
      </Button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red">
          {error}
        </p>
      )}

      <p className="mt-6 text-sm">
        <Link to="/privacy" className="text-slate hover:underline">
          Privacy
        </Link>
      </p>
    </AuthShell>
  );
}
